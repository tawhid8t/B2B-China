-- Retire active order grouping without removing historical group records or
-- changing the public RPC result shape. New rows and related wallet entries
-- carry a NULL legacy group reference.

create or replace function public.confirm_multi_sku_order(
  p_actor_id uuid,
  p_actor_role public.user_role,
  p_client_id uuid,
  p_product_link_id uuid,
  p_lines jsonb,
  p_estimated_unit_weight_kg numeric,
  p_international_shipping_category text,
  p_international_shipping_rate_bdt_per_kg numeric,
  p_idempotency_key text
)
returns table (
  order_item_id uuid, sku_id uuid, group_id uuid, group_code text,
  order_status public.order_status, wallet_transaction_id uuid,
  product_cost_cny numeric(14,2), estimated_total_bdt numeric(14,2),
  wallet_balance_cny numeric(14,2), product_base_cost_cny numeric(14,2),
  grand_estimated_total_bdt numeric(14,2), pending_payment boolean
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype; v_product public.product_links%rowtype;
  v_sku public.product_skus%rowtype; v_order public.order_items%rowtype;
  v_wallet_tx public.wallet_transactions%rowtype; v_existing public.order_confirmation_requests%rowtype;
  v_line jsonb; v_line_count integer; v_sku_id uuid; v_quantity integer;
  v_line_weight numeric(14,3); v_line_product_cost numeric(14,2);
  v_line_domestic_cny numeric(14,2); v_line_guangzhou_cny numeric(14,2);
  v_line_service_cny numeric(14,2); v_line_international_bdt numeric(14,2);
  v_line_estimated_total_bdt numeric(14,2); v_exchange_rate numeric(10,4);
  v_product_base_cny numeric(14,2) := 0; v_total_weight_kg numeric(14,3) := 0;
  v_domestic_cny numeric(14,2); v_guangzhou_cny numeric(14,2);
  v_service_cny numeric(14,2); v_total_cny numeric(14,2);
  v_converted_cny_bdt numeric(14,2); v_international_bdt numeric(14,2);
  v_grand_total_bdt numeric(14,2); v_wallet_balance numeric(14,2);
  v_previous_balance numeric(14,2); v_snapshot jsonb; v_response jsonb := '[]'::jsonb;
begin
  if p_actor_id is null or p_actor_role is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select * into v_profile from public.profiles p
  where p.id = p_actor_id and p.role = p_actor_role and p.status = 'active';
  if not found or p_actor_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'order confirmation access denied';
  end if;
  if p_actor_role = 'client' and not exists (
    select 1 from public.clients c where c.id = p_client_id and c.profile_id = p_actor_id
  ) then
    raise exception using errcode = '42501', message = 'client order access denied';
  end if;
  if p_estimated_unit_weight_kg is null or p_estimated_unit_weight_kg <= 0 then
    raise exception using errcode = '22023', message = 'positive estimated unit weight is required';
  end if;
  if p_international_shipping_rate_bdt_per_kg is null
    or p_international_shipping_rate_bdt_per_kg <= 0
    or nullif(btrim(p_international_shipping_category), '') is null then
    raise exception using errcode = '22023', message = 'valid international shipping tariff is required';
  end if;
  if jsonb_typeof(p_lines) <> 'array' then
    raise exception using errcode = '22023', message = 'order lines must be an array';
  end if;
  v_line_count := jsonb_array_length(p_lines);
  if v_line_count < 1 or v_line_count > 500 then
    raise exception using errcode = '22023', message = 'order lines must include between 1 and 500 SKU lines';
  end if;

  perform 1 from public.clients c where c.id = p_client_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'client not found'; end if;

  if nullif(btrim(p_idempotency_key), '') is not null then
    select * into v_existing from public.order_confirmation_requests ocr
    where ocr.client_id = p_client_id and ocr.idempotency_key = p_idempotency_key for update;
    if found then
      return query select item.order_item_id, item.sku_id, item.group_id, item.group_code,
        item.order_status, item.wallet_transaction_id, item.product_cost_cny,
        item.estimated_total_bdt, item.wallet_balance_cny, item.product_base_cost_cny,
        item.grand_estimated_total_bdt, item.pending_payment
      from jsonb_to_recordset(v_existing.response_snapshot) as item(
        order_item_id uuid, sku_id uuid, group_id uuid, group_code text,
        order_status public.order_status, wallet_transaction_id uuid,
        product_cost_cny numeric(14,2), estimated_total_bdt numeric(14,2),
        wallet_balance_cny numeric(14,2), product_base_cost_cny numeric(14,2),
        grand_estimated_total_bdt numeric(14,2), pending_payment boolean
      );
      return;
    end if;
  end if;

  select * into v_product from public.product_links pl where pl.id = p_product_link_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'product not found'; end if;
  if v_product.source_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'product availability requires manual review';
  end if;
  select er.cny_to_bdt into v_exchange_rate from public.exchange_rates er
  where er.effective_on <= current_date order by er.effective_on desc, er.created_at desc limit 1;
  if v_exchange_rate is null or v_exchange_rate <= 0 then
    raise exception using errcode = 'P0001', message = 'estimate exchange-rate configuration requires manual review';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku_id := (v_line ->> 'skuId')::uuid; v_quantity := (v_line ->> 'quantity')::integer;
    if v_quantity is null or v_quantity <= 0 then
      raise exception using errcode = '22023', message = 'each order line requires a positive quantity';
    end if;
    select * into v_sku from public.product_skus ps
    where ps.id = v_sku_id and ps.product_link_id = p_product_link_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'product SKU not found'; end if;
    if v_sku.available_quantity is not null and v_sku.available_quantity < v_quantity then
      raise exception using errcode = '23514', message = 'selected SKU does not have enough stock';
    end if;
    v_line_product_cost := round(v_sku.price_cny * v_quantity, 2);
    v_line_weight := round(p_estimated_unit_weight_kg * v_quantity, 3);
    v_product_base_cny := v_product_base_cny + v_line_product_cost;
    v_total_weight_kg := v_total_weight_kg + v_line_weight;
  end loop;

  v_domestic_cny := round(v_total_weight_kg * 4, 2);
  v_guangzhou_cny := round(v_total_weight_kg * 4, 2);
  v_service_cny := round(v_product_base_cny * 0.06, 2);
  v_total_cny := round(v_product_base_cny + v_domestic_cny + v_guangzhou_cny + v_service_cny, 2);
  v_converted_cny_bdt := ceil(v_total_cny * v_exchange_rate);
  v_international_bdt := round(v_total_weight_kg * p_international_shipping_rate_bdt_per_kg, 2);
  v_grand_total_bdt := v_converted_cny_bdt + v_international_bdt;
  v_snapshot := jsonb_build_object(
    'version', 2, 'flow', 'direct_multi_sku_order_confirmation', 'calculatedAt', now(),
    'inputs', jsonb_build_object('productId', p_product_link_id, 'lines', p_lines,
      'estimatedUnitWeightKg', p_estimated_unit_weight_kg,
      'internationalShippingCategory', p_international_shipping_category,
      'internationalShippingRateBdtPerKg', p_international_shipping_rate_bdt_per_kg,
      'exchangeRateCnyToBdt', v_exchange_rate),
    'costs', jsonb_build_object('productBaseCostCny', v_product_base_cny,
      'chinaDomesticShippingCny', v_domestic_cny, 'chinaToGuangzhouCostCny', v_guangzhou_cny,
      'serviceChargeCny', v_service_cny, 'totalCnyCost', v_total_cny,
      'convertedCnyCostBdt', v_converted_cny_bdt, 'internationalShippingBdt', v_international_bdt,
      'grandEstimatedTotalBdt', v_grand_total_bdt),
    'disclaimer', 'Estimated cost may change after actual weight, seller payment, and courier cost are known.'
  );

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku_id := (v_line ->> 'skuId')::uuid; v_quantity := (v_line ->> 'quantity')::integer;
    select * into v_sku from public.product_skus ps
    where ps.id = v_sku_id and ps.product_link_id = p_product_link_id for update;
    v_line_product_cost := round(v_sku.price_cny * v_quantity, 2);
    v_line_weight := round(p_estimated_unit_weight_kg * v_quantity, 3);
    v_line_domestic_cny := round(v_line_weight * 4, 2);
    v_line_guangzhou_cny := round(v_line_weight * 4, 2);
    v_line_service_cny := round(v_line_product_cost * 0.06, 2);
    v_line_international_bdt := round(v_line_weight * p_international_shipping_rate_bdt_per_kg, 2);
    v_line_estimated_total_bdt := ceil((v_line_product_cost + v_line_domestic_cny + v_line_guangzhou_cny + v_line_service_cny) * v_exchange_rate) + v_line_international_bdt;

    insert into public.order_items (
      client_id, group_id, estimate_id, product_link_id, product_sku_id, sku_id, quantity,
      cny_price, domestic_delivery_cny, estimated_weight_kg, category, estimated_total_bdt,
      actual_total_bdt, admin_notes, client_notes, wallet_reserved_cny, wallet_uncovered_cny,
      product_cost_cny, china_to_guangzhou_cny, service_charge_cny, international_shipping_bdt,
      cost_snapshot, status
    ) values (
      p_client_id, null, null, p_product_link_id, v_sku.id, v_sku.id::text, v_quantity,
      v_sku.price_cny, v_line_domestic_cny, v_line_weight, coalesce(v_product.category, 'default'),
      v_line_estimated_total_bdt, null, null, null, 0, 0, v_line_product_cost,
      v_line_guangzhou_cny, v_line_service_cny, v_line_international_bdt,
      v_snapshot || jsonb_build_object('line', jsonb_build_object(
        'skuId', v_sku.id, 'providerSkuId', v_sku.provider_sku_id, 'label', v_sku.label,
        'quantity', v_quantity, 'unitPriceCny', v_sku.price_cny, 'productCostCny', v_line_product_cost,
        'estimatedWeightKg', v_line_weight, 'chinaDomesticShippingCny', v_line_domestic_cny,
        'chinaToGuangzhouCostCny', v_line_guangzhou_cny, 'serviceChargeCny', v_line_service_cny,
        'internationalShippingBdt', v_line_international_bdt, 'estimatedTotalBdt', v_line_estimated_total_bdt
      )), 'pending_admin_review'
    ) returning * into v_order;

    v_wallet_tx := null;
    select coalesce(sum(wt.amount_cny), 0)::numeric(14,2) into v_previous_balance
    from public.wallet_transactions wt where wt.client_id = p_client_id and wt.status = 'posted';
    v_wallet_balance := round(v_previous_balance - v_line_product_cost, 2);
    if v_line_product_cost > 0 then
      insert into public.wallet_transactions (
        client_id, transaction_type, amount_bdt, amount_cny, cny_to_bdt_rate, running_balance_cny,
        status, notes, approved_by, payment_proof_id, order_item_id, order_group_id,
        product_link_id, created_by, reservation_transaction_id
      ) values (
        p_client_id, 'order_debit', -round(v_line_product_cost * v_exchange_rate, 2),
        -v_line_product_cost, v_exchange_rate, v_wallet_balance, 'posted',
        'Product base cost debited when customer confirmed order', null, null, v_order.id, null,
        p_product_link_id, p_actor_id, null
      ) returning * into v_wallet_tx;
    end if;
    v_response := v_response || jsonb_build_array(jsonb_build_object(
      'order_item_id', v_order.id, 'sku_id', v_sku.id, 'group_id', null, 'group_code', null,
      'order_status', v_order.status, 'wallet_transaction_id', case when v_wallet_tx.id is null then null else v_wallet_tx.id end,
      'product_cost_cny', v_line_product_cost, 'estimated_total_bdt', v_line_estimated_total_bdt,
      'wallet_balance_cny', v_wallet_balance, 'product_base_cost_cny', v_product_base_cny,
      'grand_estimated_total_bdt', v_grand_total_bdt, 'pending_payment', v_wallet_balance < 0
    ));
  end loop;

  if nullif(btrim(p_idempotency_key), '') is not null then
    insert into public.order_confirmation_requests (
      client_id, idempotency_key, product_link_id, group_id, request_snapshot, response_snapshot
    ) values (
      p_client_id, p_idempotency_key, p_product_link_id, null,
      jsonb_build_object('actorId', p_actor_id, 'actorRole', p_actor_role,
        'productId', p_product_link_id, 'lines', p_lines,
        'estimatedUnitWeightKg', p_estimated_unit_weight_kg,
        'internationalShippingCategory', p_international_shipping_category), v_response
    );
  end if;

  return query select item.order_item_id, item.sku_id, item.group_id, item.group_code,
    item.order_status, item.wallet_transaction_id, item.product_cost_cny, item.estimated_total_bdt,
    item.wallet_balance_cny, item.product_base_cost_cny, item.grand_estimated_total_bdt,
    item.pending_payment
  from jsonb_to_recordset(v_response) as item(
    order_item_id uuid, sku_id uuid, group_id uuid, group_code text,
    order_status public.order_status, wallet_transaction_id uuid,
    product_cost_cny numeric(14,2), estimated_total_bdt numeric(14,2),
    wallet_balance_cny numeric(14,2), product_base_cost_cny numeric(14,2),
    grand_estimated_total_bdt numeric(14,2), pending_payment boolean
  );
end;
$$;

create or replace function private.accept_estimate_with_reservation_internal(
  p_estimate_id uuid, p_client_id uuid
)
returns table (
  order_item_id uuid, group_id uuid, group_code text, order_status public.order_status,
  wallet_reservation_status text, reservation_transaction_id uuid,
  required_amount_cny numeric(14,2), reserved_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2), wallet_balance_cny numeric(14,2)
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_role public.user_role; v_estimate public.estimates%rowtype;
  v_order public.order_items%rowtype; v_reservation public.wallet_transactions%rowtype;
  v_category text; v_required numeric(14,2); v_available numeric(14,2);
  v_reserved numeric(14,2); v_uncovered numeric(14,2); v_before jsonb;
begin
  if v_actor is null then raise exception using errcode = '42501', message = 'authentication required'; end if;
  select p.role into v_role from public.profiles p where p.id = v_actor;
  select * into v_estimate from public.estimates e where e.id = p_estimate_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'estimate not found'; end if;
  if v_estimate.client_id <> p_client_id then
    raise exception using errcode = '42501', message = 'estimate client does not match request';
  end if;
  if v_role not in ('admin', 'super_admin') and not exists (
    select 1 from public.clients c where c.id = p_client_id and c.profile_id = v_actor
  ) then raise exception using errcode = '42501', message = 'estimate access denied'; end if;
  perform 1 from public.clients c where c.id = p_client_id for update;

  if v_estimate.status = 'converted_to_order' then
    select * into v_order from public.order_items oi where oi.estimate_id = p_estimate_id;
    if not found then raise exception using errcode = 'P0001', message = 'converted estimate is missing its order item'; end if;
    select * into v_reservation from public.wallet_transactions wt
    where wt.order_item_id = v_order.id and wt.transaction_type = 'reservation';
    select coalesce(sum(wt.amount_cny), 0)::numeric(14,2) into v_available
    from public.wallet_transactions wt where wt.client_id = p_client_id and wt.status = 'posted';
    return query select v_order.id, null::uuid, null::text, v_order.status,
      case when v_order.wallet_uncovered_cny = 0 then 'reserved'
        when v_order.wallet_reserved_cny > 0 then 'reserved_or_partial' else 'insufficient_balance' end,
      v_reservation.id, (v_order.wallet_reserved_cny + v_order.wallet_uncovered_cny)::numeric(14,2),
      v_order.wallet_reserved_cny, v_order.wallet_uncovered_cny, v_available;
    return;
  end if;
  if v_estimate.status <> 'sent_to_client' then
    raise exception using errcode = '23514', message = 'estimate is not available for acceptance';
  end if;
  if v_estimate.valid_until <= now() then raise exception using errcode = 'P0001', message = 'estimate has expired'; end if;
  if v_estimate.exchange_rate_cny_to_bdt is null or v_estimate.exchange_rate_cny_to_bdt <= 0 then
    raise exception using errcode = '23514', message = 'estimate is missing its exchange-rate snapshot';
  end if;
  v_required := round(v_estimate.total_bdt / v_estimate.exchange_rate_cny_to_bdt, 2);
  select coalesce(sum(wt.amount_cny), 0)::numeric(14,2) into v_available
  from public.wallet_transactions wt where wt.client_id = p_client_id and wt.status = 'posted';
  v_reserved := greatest(least(v_available, v_required), 0)::numeric(14,2);
  v_uncovered := greatest(v_required - v_reserved, 0)::numeric(14,2); v_before := to_jsonb(v_estimate);
  update public.estimates set status = 'accepted' where id = p_estimate_id;
  select pl.category into v_category from public.product_links pl where pl.id = v_estimate.product_link_id;
  insert into public.order_items (
    client_id, group_id, estimate_id, product_link_id, product_sku_id, sku_id, quantity, cny_price,
    domestic_delivery_cny, estimated_weight_kg, category, estimated_total_bdt,
    wallet_reserved_cny, wallet_uncovered_cny, status
  ) values (
    v_estimate.client_id, null, v_estimate.id, v_estimate.product_link_id, v_estimate.product_sku_id,
    v_estimate.sku_id, v_estimate.quantity, v_estimate.unit_price_cny, v_estimate.domestic_delivery_cny,
    v_estimate.estimated_total_weight_kg, coalesce(v_category, 'default'), v_estimate.total_bdt,
    v_reserved, v_uncovered, 'pending_admin_review'
  ) returning * into v_order;
  if v_reserved > 0 then
    v_reservation := private.post_wallet_transaction_internal(
      v_estimate.client_id, 'reservation', -round(v_reserved * v_estimate.exchange_rate_cny_to_bdt, 2),
      -v_reserved, v_estimate.exchange_rate_cny_to_bdt, null, v_order.id, null,
      v_estimate.product_link_id, 'Reserved when estimate was accepted', null
    );
  end if;
  update public.estimates set status = 'converted_to_order' where id = p_estimate_id returning * into v_estimate;
  perform private.write_audit_log_internal('estimate', v_estimate.id, 'estimate_accepted_and_converted',
    v_before, to_jsonb(v_estimate), case when v_uncovered > 0 then 'accepted with insufficient wallet balance warning' else null end);
  return query select v_order.id, null::uuid, null::text, v_order.status,
    case when v_uncovered = 0 then 'reserved' when v_reserved > 0 then 'reserved_or_partial' else 'insufficient_balance' end,
    v_reservation.id, v_required, v_reserved, v_uncovered, (v_available - v_reserved)::numeric(14,2);
end;
$$;

revoke all on function public.confirm_multi_sku_order(
  uuid, public.user_role, uuid, uuid, jsonb, numeric, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.confirm_multi_sku_order(
  uuid, public.user_role, uuid, uuid, jsonb, numeric, text, numeric, text
) to service_role;
