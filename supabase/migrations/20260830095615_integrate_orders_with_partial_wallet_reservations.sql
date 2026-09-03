-- Phase 5: connect every order path to non-negative, partial wallet coverage.
-- Existing order and ledger rows remain unchanged; the new snapshot fields are
-- populated only by new confirmations and purchase commitments.
begin;

alter table public.order_items
  add column wallet_required_cny numeric(14,2),
  add column wallet_rate_cny_to_bdt numeric(10,4),
  add column wallet_committed_cny numeric(14,2),
  add column wallet_committed_at timestamptz,
  add column wallet_committed_by uuid references public.profiles(id) on delete restrict,
  add column wallet_rate_adjustment_reason text,
  add constraint order_items_wallet_required_nonnegative
    check (wallet_required_cny is null or wallet_required_cny >= 0),
  add constraint order_items_wallet_rate_positive
    check (wallet_rate_cny_to_bdt is null or wallet_rate_cny_to_bdt > 0),
  add constraint order_items_wallet_committed_nonnegative
    check (wallet_committed_cny is null or wallet_committed_cny >= 0),
  add constraint order_items_wallet_commit_complete
    check (
      (wallet_committed_at is null and wallet_committed_by is null and wallet_committed_cny is null)
      or
      (wallet_committed_at is not null and wallet_committed_by is not null and wallet_committed_cny is not null)
    );

comment on column public.order_items.wallet_required_cny is
  'Supplier CNY amount requiring wallet coverage at confirmation, replaced by actual paid CNY at purchase commitment.';
comment on column public.order_items.wallet_rate_cny_to_bdt is
  'Immutable estimate/direct-confirmation rate snapshot, or the audited adjusted rate applied at purchase commitment.';
comment on column public.order_items.wallet_committed_cny is
  'Wallet-covered CNY actually debited at audited purchase commitment.';
comment on column public.order_items.wallet_rate_adjustment_reason is
  'Required audit reason when purchase commitment overrides the order rate snapshot.';

create or replace function private.capture_order_wallet_snapshot()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.wallet_required_cny is null then
    new.wallet_required_cny := round(new.wallet_reserved_cny + new.wallet_uncovered_cny, 2);
  end if;

  if new.wallet_rate_cny_to_bdt is null and new.estimate_id is not null then
    select e.exchange_rate_cny_to_bdt
    into new.wallet_rate_cny_to_bdt
    from public.estimates e
    where e.id = new.estimate_id;
  end if;

  return new;
end;
$$;

revoke all on function private.capture_order_wallet_snapshot() from public, anon, authenticated;

create trigger order_items_capture_wallet_snapshot
before insert on public.order_items
for each row execute function private.capture_order_wallet_snapshot();

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
  v_reserved numeric(14,2); v_uncovered numeric(14,2);
  v_snapshot jsonb; v_response jsonb := '[]'::jsonb;
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
    'version', 3, 'flow', 'direct_multi_sku_order_confirmation', 'calculatedAt', now(),
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

    select coalesce(sum(wt.amount_cny), 0)::numeric(14,2) into v_wallet_balance
    from public.wallet_transactions wt where wt.client_id = p_client_id and wt.status = 'posted';
    v_reserved := greatest(least(v_wallet_balance, v_line_product_cost), 0)::numeric(14,2);
    v_uncovered := greatest(v_line_product_cost - v_reserved, 0)::numeric(14,2);

    insert into public.order_items (
      client_id, group_id, estimate_id, product_link_id, product_sku_id, sku_id, quantity,
      cny_price, domestic_delivery_cny, estimated_weight_kg, category, estimated_total_bdt,
      actual_total_bdt, admin_notes, client_notes, wallet_required_cny, wallet_reserved_cny,
      wallet_uncovered_cny, wallet_rate_cny_to_bdt, product_cost_cny,
      china_to_guangzhou_cny, service_charge_cny, international_shipping_bdt, cost_snapshot, status
    ) values (
      p_client_id, null, null, p_product_link_id, v_sku.id, v_sku.id::text, v_quantity,
      v_sku.price_cny, v_line_domestic_cny, v_line_weight, coalesce(v_product.category, 'default'),
      v_line_estimated_total_bdt, null, null, null, v_line_product_cost, v_reserved, v_uncovered,
      v_exchange_rate, v_line_product_cost, v_line_guangzhou_cny, v_line_service_cny,
      v_line_international_bdt,
      v_snapshot || jsonb_build_object('line', jsonb_build_object(
        'skuId', v_sku.id, 'providerSkuId', v_sku.provider_sku_id, 'label', v_sku.label,
        'quantity', v_quantity, 'unitPriceCny', v_sku.price_cny, 'productCostCny', v_line_product_cost,
        'estimatedWeightKg', v_line_weight, 'chinaDomesticShippingCny', v_line_domestic_cny,
        'chinaToGuangzhouCostCny', v_line_guangzhou_cny, 'serviceChargeCny', v_line_service_cny,
        'internationalShippingBdt', v_line_international_bdt, 'estimatedTotalBdt', v_line_estimated_total_bdt,
        'walletCoverage', jsonb_build_object('requiredCny', v_line_product_cost,
          'reservedCny', v_reserved, 'uncoveredCny', v_uncovered, 'rateCnyToBdt', v_exchange_rate)
      )), 'pending_admin_review'
    ) returning * into v_order;

    v_wallet_tx := null;
    if v_reserved > 0 then
      v_wallet_balance := round(v_wallet_balance - v_reserved, 2);
      insert into public.wallet_transactions (
        client_id, transaction_type, amount_bdt, amount_cny, cny_to_bdt_rate, running_balance_cny,
        status, notes, approved_by, payment_proof_id, order_item_id, order_group_id,
        product_link_id, created_by, reservation_transaction_id
      ) values (
        p_client_id, 'reservation', -round(v_reserved * v_exchange_rate, 2), -v_reserved,
        v_exchange_rate, v_wallet_balance, 'posted',
        'Reserved when customer confirmed order', p_actor_id, null, v_order.id, null,
        p_product_link_id, p_actor_id, null
      ) returning * into v_wallet_tx;
    end if;

    v_response := v_response || jsonb_build_array(jsonb_build_object(
      'order_item_id', v_order.id, 'sku_id', v_sku.id, 'group_id', null, 'group_code', null,
      'order_status', v_order.status,
      'wallet_transaction_id', case when v_wallet_tx.id is null then null else v_wallet_tx.id end,
      'product_cost_cny', v_line_product_cost, 'estimated_total_bdt', v_line_estimated_total_bdt,
      'wallet_balance_cny', v_wallet_balance, 'product_base_cost_cny', v_product_base_cny,
      'grand_estimated_total_bdt', v_grand_total_bdt, 'pending_payment', v_uncovered > 0
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

revoke all on function public.confirm_multi_sku_order(
  uuid, public.user_role, uuid, uuid, jsonb, numeric, text, numeric, text
) from public, anon, authenticated;
grant execute on function public.confirm_multi_sku_order(
  uuid, public.user_role, uuid, uuid, jsonb, numeric, text, numeric, text
) to service_role;

create or replace function private.convert_wallet_reservation_to_order_debit_internal(
  p_order_item_id uuid,
  p_actual_paid_cny numeric,
  p_cny_to_bdt_rate numeric default null,
  p_reason text default null
)
returns table (
  reservation_transaction_id uuid,
  release_transaction_id uuid,
  debit_transaction_id uuid,
  reserved_amount_cny numeric(14,2),
  debited_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2),
  applied_rate numeric(10,4)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_client_id uuid;
  v_order public.order_items%rowtype;
  v_reservation public.wallet_transactions%rowtype;
  v_release public.wallet_transactions%rowtype;
  v_debit public.wallet_transactions%rowtype;
  v_snapshot_rate numeric(10,4);
  v_rate numeric(10,4);
  v_reserved numeric(14,2) := 0;
  v_debited numeric(14,2) := 0;
  v_uncovered numeric(14,2);
  v_actual numeric(14,2);
  v_reason text := nullif(btrim(p_reason), '');
begin
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if p_actual_paid_cny is null or p_actual_paid_cny <= 0 then
    raise exception using errcode = '22023', message = 'positive actual paid CNY amount required';
  end if;
  v_actual := round(p_actual_paid_cny, 2);

  select oi.client_id into v_client_id from public.order_items oi where oi.id = p_order_item_id;
  if not found then raise exception using errcode = 'P0002', message = 'order item not found'; end if;
  perform 1 from public.clients c where c.id = v_client_id for update;
  select * into v_order from public.order_items oi where oi.id = p_order_item_id for update;

  v_snapshot_rate := v_order.wallet_rate_cny_to_bdt;
  if v_snapshot_rate is null and v_order.estimate_id is not null then
    select e.exchange_rate_cny_to_bdt into v_snapshot_rate
    from public.estimates e where e.id = v_order.estimate_id;
  end if;
  if v_snapshot_rate is null and jsonb_typeof(v_order.cost_snapshot) = 'object' then
    v_snapshot_rate := nullif(v_order.cost_snapshot #>> '{inputs,exchangeRateCnyToBdt}', '')::numeric;
  end if;

  v_rate := coalesce(p_cny_to_bdt_rate, v_snapshot_rate);
  if v_rate is null or v_rate <= 0 then
    raise exception using errcode = '23514', message = 'purchase commitment requires the order exchange-rate snapshot';
  end if;
  if p_cny_to_bdt_rate is not null
     and v_snapshot_rate is not null
     and round(p_cny_to_bdt_rate, 4) <> round(v_snapshot_rate, 4)
     and v_reason is null then
    raise exception using errcode = '22023', message = 'exchange-rate override reason is required';
  end if;

  select * into v_reservation
  from public.wallet_transactions wt
  where wt.order_item_id = p_order_item_id
    and wt.transaction_type = 'reservation'
    and wt.status = 'posted'
  for update;

  if found then
    v_reserved := abs(v_reservation.amount_cny)::numeric(14,2);
    select * into v_debit
    from public.wallet_transactions wt
    where wt.reservation_transaction_id = v_reservation.id
      and wt.transaction_type = 'order_debit'
      and wt.status = 'posted';
  end if;

  if v_order.wallet_committed_at is not null or v_debit.id is not null then
    if v_order.wallet_required_cny is not null and v_order.wallet_required_cny <> v_actual then
      raise exception using errcode = '23505', message = 'purchase commitment retry conflicts with the settled paid amount';
    end if;
    if p_cny_to_bdt_rate is not null
       and coalesce(v_debit.cny_to_bdt_rate, v_order.wallet_rate_cny_to_bdt) <> round(p_cny_to_bdt_rate, 4) then
      raise exception using errcode = '23505', message = 'purchase commitment retry conflicts with the settled exchange rate';
    end if;
    if v_reservation.id is not null then
      select * into v_release from public.wallet_transactions wt
      where wt.reservation_transaction_id = v_reservation.id
        and wt.transaction_type = 'reservation_release' and wt.status = 'posted';
    end if;
    return query select v_reservation.id, v_release.id, v_debit.id, v_reserved,
      coalesce(abs(v_debit.amount_cny), v_order.wallet_committed_cny, 0)::numeric(14,2),
      v_order.wallet_uncovered_cny,
      coalesce(v_debit.cny_to_bdt_rate, v_order.wallet_rate_cny_to_bdt, v_rate)::numeric(10,4);
    return;
  end if;

  if v_reservation.id is null then
    v_uncovered := v_actual;
    update public.order_items
    set wallet_required_cny = v_actual,
        wallet_uncovered_cny = v_uncovered,
        wallet_committed_cny = 0,
        wallet_rate_cny_to_bdt = v_rate,
        wallet_committed_at = now(),
        wallet_committed_by = v_actor,
        wallet_rate_adjustment_reason = case
          when v_snapshot_rate is not null and v_rate <> v_snapshot_rate then v_reason else null end,
        updated_at = now()
    where id = p_order_item_id;
    return query select null::uuid, null::uuid, null::uuid,
      0::numeric(14,2), 0::numeric(14,2), v_uncovered, v_rate;
    return;
  end if;

  if exists (
    select 1 from public.wallet_transactions wt
    where wt.reservation_transaction_id = v_reservation.id
      and wt.transaction_type = 'reservation_release' and wt.status = 'posted'
  ) then
    raise exception using errcode = '23514', message = 'wallet reservation was already released';
  end if;

  v_release := private.release_wallet_reservation_internal(
    p_order_item_id,
    coalesce(v_reason, 'reservation converted at purchase commitment')
  );
  v_debited := least(v_reserved, v_actual)::numeric(14,2);
  v_uncovered := greatest(v_actual - v_debited, 0)::numeric(14,2);

  if v_debited > 0 then
    v_debit := private.post_wallet_transaction_internal(
      v_order.client_id, 'order_debit', -round(v_debited * v_rate, 2), -v_debited,
      v_rate, null, v_order.id, v_order.group_id, v_order.product_link_id,
      coalesce(v_reason, 'wallet debit committed at provider purchase'), v_reservation.id
    );
  end if;

  update public.order_items
  set wallet_required_cny = v_actual,
      wallet_uncovered_cny = v_uncovered,
      wallet_committed_cny = v_debited,
      wallet_rate_cny_to_bdt = v_rate,
      wallet_committed_at = now(),
      wallet_committed_by = v_actor,
      wallet_rate_adjustment_reason = case
        when v_snapshot_rate is not null and v_rate <> v_snapshot_rate then v_reason else null end,
      updated_at = now()
  where id = p_order_item_id;

  return query select v_reservation.id, v_release.id, v_debit.id,
    v_reserved, v_debited, v_uncovered, v_rate;
end;
$$;

revoke all on function private.convert_wallet_reservation_to_order_debit_internal(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function private.convert_wallet_reservation_to_order_debit_internal(uuid, numeric, numeric, text)
  to authenticated, service_role;

create or replace function private.sync_provider_order_and_commit_wallet_internal(
  p_order_item_id uuid, p_provider text, p_provider_order_id text, p_paid_amount_cny numeric,
  p_seller_tracking_number text, p_provider_status text, p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null
)
returns table (
  provider_order_record_id uuid, order_item_status public.order_status, synced_at timestamptz,
  reservation_transaction_id uuid, release_transaction_id uuid, debit_transaction_id uuid,
  debited_amount_cny numeric(14,2), uncovered_amount_cny numeric(14,2), applied_rate numeric(10,4)
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_role public.user_role; v_order public.order_items%rowtype;
  v_provider_order public.provider_orders%rowtype; v_commit record; v_synced_at timestamptz := now();
  v_normalized_status public.provider_order_status;
  v_rate_reason text := nullif(btrim(coalesce(p_raw_payload, '{}'::jsonb) ->> 'rateAdjustmentReason'), '');
begin
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_actor is null or v_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'admin role required'; end if;
  if nullif(btrim(p_provider), '') is null or nullif(btrim(p_provider_order_id), '') is null then raise exception using errcode = '22023', message = 'provider and provider order ID are required'; end if;
  if p_paid_amount_cny is null or p_paid_amount_cny <= 0 then raise exception using errcode = '22023', message = 'positive paid amount is required'; end if;

  select * into v_order from public.order_items oi where oi.id = p_order_item_id;
  if not found then raise exception using errcode = 'P0002', message = 'order item not found'; end if;
  if v_order.status not in ('queued_for_purchase', 'purchased', 'seller_shipped') then raise exception using errcode = '23514', message = 'order is not eligible for provider purchase sync'; end if;

  v_normalized_status := case
    when p_provider_status in ('cancelled', 'refund_requested', 'refunded', 'exception') then p_provider_status::public.provider_order_status
    when p_provider_status in ('seller_shipped', 'shipped') or nullif(btrim(p_seller_tracking_number), '') is not null then 'seller_shipped'::public.provider_order_status
    else 'paid'::public.provider_order_status
  end;

  insert into public.provider_orders (order_item_id, provider, provider_order_id, paid_amount_cny, seller_tracking_number, provider_status, status, raw_payload, synced_at)
  values (p_order_item_id, btrim(p_provider), btrim(p_provider_order_id), p_paid_amount_cny, nullif(btrim(p_seller_tracking_number), ''), p_provider_status, v_normalized_status, coalesce(p_raw_payload, '{}'::jsonb), v_synced_at)
  on conflict (provider, provider_order_id, order_item_id) where provider_order_id is not null
  do update set
    seller_tracking_number = coalesce(excluded.seller_tracking_number, public.provider_orders.seller_tracking_number),
    provider_status = excluded.provider_status, status = excluded.status,
    raw_payload = excluded.raw_payload, synced_at = excluded.synced_at
  where public.provider_orders.paid_amount_cny = excluded.paid_amount_cny
  returning * into v_provider_order;
  if not found then raise exception using errcode = '23505', message = 'provider order line conflicts with an existing paid purchase'; end if;

  select * into v_commit from private.convert_wallet_reservation_to_order_debit_internal(
    p_order_item_id, p_paid_amount_cny, p_cny_to_bdt_rate,
    case when p_cny_to_bdt_rate is null then 'provider order synced and purchase committed' else v_rate_reason end
  );
  update public.order_items set actual_total_bdt = round(p_paid_amount_cny * v_commit.applied_rate, 2), updated_at = now() where id = p_order_item_id;
  select * into v_order from public.order_items oi where oi.id = p_order_item_id;
  if v_order.status = 'queued_for_purchase' then v_order := private.change_order_status_internal(p_order_item_id, 'purchased', 'provider order and paid amount recorded'); end if;
  if v_order.status = 'purchased' and v_normalized_status = 'seller_shipped' then v_order := private.change_order_status_internal(p_order_item_id, 'seller_shipped', 'seller tracking recorded by provider sync'); end if;

  insert into public.integration_logs (provider, operation, request_payload, response_payload, status)
  values (btrim(p_provider), 'provider_order_sync',
    jsonb_build_object('orderItemId', p_order_item_id, 'providerOrderId', p_provider_order_id,
      'paidAmountCny', p_paid_amount_cny, 'providerStatus', p_provider_status,
      'requestedRate', p_cny_to_bdt_rate, 'rateAdjustmentReason', v_rate_reason),
    jsonb_build_object('providerOrderRecordId', v_provider_order.id, 'orderStatus', v_order.status,
      'debitTransactionId', v_commit.debit_transaction_id,
      'uncoveredAmountCny', v_commit.uncovered_amount_cny, 'appliedRate', v_commit.applied_rate), 'success');

  return query select v_provider_order.id, v_order.status, v_synced_at,
    v_commit.reservation_transaction_id, v_commit.release_transaction_id,
    v_commit.debit_transaction_id, v_commit.debited_amount_cny,
    v_commit.uncovered_amount_cny, v_commit.applied_rate;
end;
$$;

revoke all on function private.sync_provider_order_and_commit_wallet_internal(uuid, text, text, numeric, text, text, jsonb, numeric) from public, anon;
grant execute on function private.sync_provider_order_and_commit_wallet_internal(uuid, text, text, numeric, text, text, jsonb, numeric) to authenticated, service_role;

create or replace function public.get_client_order_cards()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  if (select auth.uid()) is null or (select public.current_user_role()) <> 'client' then
    raise exception using errcode = '42501', message = 'client role required';
  end if;
  select c.id into v_client_id from public.clients c where c.profile_id = (select auth.uid());
  if v_client_id is null then return jsonb_build_object('orders', '[]'::jsonb); end if;

  return (
    with source_lines as (
      select oi.id, oi.product_link_id, oi.quantity, oi.cny_price, oi.domestic_delivery_cny,
        oi.international_shipping_bdt, oi.estimated_total_bdt, oi.actual_total_bdt,
        oi.status, oi.created_at, oi.client_notes,
        coalesce(oi.product_cost_cny, round(oi.cny_price * oi.quantity, 2)) as supplier_cost_cny,
        oi.wallet_required_cny, oi.wallet_reserved_cny, oi.wallet_uncovered_cny,
        oi.wallet_committed_cny, oi.wallet_committed_at, oi.wallet_rate_cny_to_bdt,
        coalesce(oi.wallet_rate_cny_to_bdt,
          nullif(oi.cost_snapshot #>> '{inputs,exchangeRateCnyToBdt}', '')::numeric,
          est.exchange_rate_cny_to_bdt) as exchange_rate,
        pl.provider_item_id as product_id, left(pl.title, 180) as short_description,
        pl.images as product_images, pl.original_url as product_url,
        ps.label as sku_description, ps.attributes as sku_attributes,
        ps.image_url as sku_image_url, ps.price_cny as sku_price_cny,
        po.provider, po.provider_order_id, po.paid_amount_cny,
        case oi.status
          when 'exception' then 0 when 'cancelled' then 1
          when 'pending_admin_review' then 10 when 'confirmed' then 20
          when 'queued_for_purchase' then 30 when 'purchased' then 40
          when 'seller_shipped' then 50 when 'received_china' then 60
          when 'qc_checked' then 70 when 'packed' then 80
          when 'sent_guangzhou' then 90 when 'arrived_guangzhou' then 100
          when 'sent_bangladesh' then 110 when 'arrived_bangladesh' then 120
          when 'ready_for_pickup' then 130 when 'completed' then 140 else 999
        end as status_rank
      from public.order_items oi
      join public.product_links pl on pl.id = oi.product_link_id
      left join public.product_skus ps on ps.id = oi.product_sku_id
      left join public.estimates est on est.id = oi.estimate_id
      left join lateral (
        select p.provider, p.provider_order_id, p.paid_amount_cny
        from public.provider_orders p where p.order_item_id = oi.id
        order by p.synced_at desc nulls last, p.created_at desc, p.id desc limit 1
      ) po on true
      where oi.client_id = v_client_id
    ),
    keyed as (
      select s.*, s.product_link_id::text as order_key
      from source_lines s
    ),
    grouped as (
      select order_key, max(provider_order_id) as provider_order_number, max(provider) as store_name,
        max(product_id) as product_id, max(short_description) as short_description,
        max(product_images) as product_images, max(product_url) as product_url,
        min(created_at) as ordered_at, min(status_rank) as status_rank,
        (array_agg(status order by status_rank, created_at, id))[1] as status,
        bool_and(actual_total_bdt is not null) as all_actual,
        bool_or(actual_total_bdt is not null) as any_actual,
        sum(case when exchange_rate is not null then (supplier_cost_cny + domestic_delivery_cny) * exchange_rate end)::numeric(14,2) as total_amount_bdt,
        sum(supplier_cost_cny)::numeric(14,2) as supplier_total_cny,
        sum(case when exchange_rate is not null then round(supplier_cost_cny * exchange_rate, 2) end)::numeric(14,2) as supplier_total_bdt,
        sum(domestic_delivery_cny)::numeric(14,2) as shipping_total_cny,
        sum(case when exchange_rate is not null then round(domestic_delivery_cny * exchange_rate, 2) end)::numeric(14,2) as shipping_total_bdt,
        sum(coalesce(wallet_required_cny, wallet_reserved_cny + wallet_uncovered_cny))::numeric(14,2) as wallet_required_cny,
        sum(wallet_reserved_cny)::numeric(14,2) as wallet_reserved_cny,
        sum(case when wallet_committed_at is null then wallet_reserved_cny else coalesce(wallet_committed_cny, 0) end)::numeric(14,2) as wallet_covered_cny,
        sum(wallet_uncovered_cny)::numeric(14,2) as wallet_uncovered_cny,
        case when min(wallet_rate_cny_to_bdt) = max(wallet_rate_cny_to_bdt) then max(wallet_rate_cny_to_bdt) else null end as wallet_rate_cny_to_bdt,
        bool_or(wallet_committed_at is not null) as wallet_committed,
        jsonb_agg(jsonb_build_object(
          'id', id, 'imageUrl', coalesce(sku_image_url, product_images[1]),
          'description', coalesce(sku_description, short_description),
          'attributes', coalesce(sku_attributes, '{}'::jsonb),
          'color', coalesce(sku_attributes->>'color', sku_attributes->>'Color', sku_attributes->>'颜色'),
          'size', coalesce(sku_attributes->>'size', sku_attributes->>'Size', sku_attributes->>'尺码', sku_attributes->>'尺寸', sku_attributes->>'产品规格'),
          'unitPriceCny', coalesce(sku_price_cny, cny_price), 'quantity', quantity,
          'subtotalCny', round(coalesce(sku_price_cny, cny_price) * quantity, 2),
          'subtotalBdt', case when exchange_rate is not null then round(coalesce(sku_price_cny, cny_price) * quantity * exchange_rate, 2) end,
          'shippingFeeCny', domestic_delivery_cny,
          'shippingFeeBdt', international_shipping_bdt, 'status', status, 'note', client_notes,
          'walletRequiredCny', coalesce(wallet_required_cny, wallet_reserved_cny + wallet_uncovered_cny),
          'walletReservedCny', wallet_reserved_cny,
          'walletCoveredCny', case when wallet_committed_at is null then wallet_reserved_cny else coalesce(wallet_committed_cny, 0) end,
          'walletUncoveredCny', wallet_uncovered_cny,
          'walletRateCnyToBdt', wallet_rate_cny_to_bdt,
          'walletCommitted', wallet_committed_at is not null
        ) order by created_at, id) as skus
      from keyed group by order_key
    )
    select jsonb_build_object('orders', coalesce(jsonb_agg(jsonb_build_object(
      'orderId', order_key, 'productId', product_id,
      'providerOrderNumber', provider_order_number,
      'displayOrderNumber', coalesce(provider_order_number, 'Pending - ' || order_key),
      'orderedAt', ordered_at,
      'product', jsonb_build_object('imageUrl', product_images[1],
        'productUrl', product_url,
        'shortDescription', coalesce(short_description, 'Product details unavailable'),
        'storeName', store_name, 'storeAccount', null),
      'skus', skus, 'supplierTotalCny', supplier_total_cny,
      'supplierTotalBdt', supplier_total_bdt, 'shippingTotalCny', shipping_total_cny,
      'shippingTotalBdt', shipping_total_bdt, 'totalAmountBdt', total_amount_bdt,
      'totalAmountState', case when all_actual then 'actual' when any_actual then 'partial' when total_amount_bdt is not null then 'estimated' else 'unavailable' end,
      'status', status,
      'walletCoverage', jsonb_build_object('requiredCny', wallet_required_cny,
        'reservedCny', wallet_reserved_cny, 'coveredCny', wallet_covered_cny,
        'uncoveredCny', wallet_uncovered_cny, 'rateCnyToBdt', wallet_rate_cny_to_bdt,
        'committed', wallet_committed),
      'favorite', jsonb_build_object('eligible', status not in ('cancelled', 'exception') and status_rank >= 20,
        'active', exists (select 1 from public.client_favorites f where f.source_order_item_id = (skus->0->>'id')::uuid and f.status = 'active'),
        'favoriteId', (select f.id from public.client_favorites f where f.source_order_item_id = (skus->0->>'id')::uuid and f.status = 'active' limit 1))
    ) order by ordered_at desc, order_key), '[]'::jsonb)) from grouped
  );
end;
$$;

revoke all on function public.get_client_order_cards() from public, anon;
grant execute on function public.get_client_order_cards() to authenticated;

commit;
