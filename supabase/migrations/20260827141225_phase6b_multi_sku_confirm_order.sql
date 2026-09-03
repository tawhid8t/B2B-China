begin;

alter table public.order_items
  add column if not exists product_cost_cny numeric(14,2),
  add column if not exists china_to_guangzhou_cny numeric(14,2),
  add column if not exists service_charge_cny numeric(14,2),
  add column if not exists international_shipping_bdt numeric(14,2),
  add column if not exists cost_snapshot jsonb;

comment on column public.order_items.product_cost_cny is
  'Supplier product base cost for this SKU line. This is the customer wallet debit amount at direct confirmation.';
comment on column public.order_items.china_to_guangzhou_cny is
  'Estimated China-to-Guangzhou logistics component at direct confirmation.';
comment on column public.order_items.service_charge_cny is
  'Estimated service charge component at direct confirmation; currently 6% of product_cost_cny.';
comment on column public.order_items.international_shipping_bdt is
  'Estimated Bangladesh international shipping component at direct confirmation.';
comment on column public.order_items.cost_snapshot is
  'Immutable customer-confirmation estimate snapshot for direct multi-SKU order flow.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_product_cost_cny_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_product_cost_cny_nonnegative
      check (product_cost_cny is null or product_cost_cny >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_china_to_guangzhou_cny_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_china_to_guangzhou_cny_nonnegative
      check (china_to_guangzhou_cny is null or china_to_guangzhou_cny >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_service_charge_cny_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_service_charge_cny_nonnegative
      check (service_charge_cny is null or service_charge_cny >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'order_items_international_shipping_bdt_nonnegative'
      and conrelid = 'public.order_items'::regclass
  ) then
    alter table public.order_items
      add constraint order_items_international_shipping_bdt_nonnegative
      check (international_shipping_bdt is null or international_shipping_bdt >= 0);
  end if;
end $$;

create table if not exists public.order_confirmation_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  idempotency_key text not null check (nullif(btrim(idempotency_key), '') is not null),
  product_link_id uuid not null references public.product_links(id) on delete restrict,
  group_id uuid references public.order_groups(id) on delete restrict,
  request_snapshot jsonb not null,
  response_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique (client_id, idempotency_key)
);

alter table public.order_confirmation_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'order_confirmation_requests'
      and policyname = 'order_confirmation_requests_select_own_or_admin'
  ) then
    create policy order_confirmation_requests_select_own_or_admin
    on public.order_confirmation_requests for select to authenticated
    using (
      (
        (select public.current_user_role()) = 'client'
        and client_id in (select id from public.clients where profile_id = (select auth.uid()))
      )
      or (select public.current_user_role()) in ('admin', 'super_admin')
    );
  end if;
end $$;

grant select on public.order_confirmation_requests to authenticated;

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
  order_item_id uuid,
  sku_id uuid,
  group_id uuid,
  group_code text,
  order_status public.order_status,
  wallet_transaction_id uuid,
  product_cost_cny numeric(14,2),
  estimated_total_bdt numeric(14,2),
  wallet_balance_cny numeric(14,2),
  product_base_cost_cny numeric(14,2),
  grand_estimated_total_bdt numeric(14,2),
  pending_payment boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_product public.product_links%rowtype;
  v_group public.order_groups%rowtype;
  v_sku public.product_skus%rowtype;
  v_order public.order_items%rowtype;
  v_wallet_tx public.wallet_transactions%rowtype;
  v_line jsonb;
  v_line_count integer;
  v_line_index integer := 0;
  v_sku_id uuid;
  v_quantity integer;
  v_line_weight numeric(14,3);
  v_line_product_cost numeric(14,2);
  v_line_domestic_cny numeric(14,2);
  v_line_guangzhou_cny numeric(14,2);
  v_line_service_cny numeric(14,2);
  v_line_international_bdt numeric(14,2);
  v_line_estimated_total_bdt numeric(14,2);
  v_exchange_rate numeric(10,4);
  v_product_base_cny numeric(14,2) := 0;
  v_total_weight_kg numeric(14,3) := 0;
  v_domestic_cny numeric(14,2);
  v_guangzhou_cny numeric(14,2);
  v_service_cny numeric(14,2);
  v_total_cny numeric(14,2);
  v_converted_cny_bdt numeric(14,2);
  v_international_bdt numeric(14,2);
  v_grand_total_bdt numeric(14,2);
  v_wallet_balance numeric(14,2);
  v_previous_balance numeric(14,2);
  v_open_count integer;
  v_attempt integer;
  v_snapshot jsonb;
  v_response jsonb := '[]'::jsonb;
  v_existing public.order_confirmation_requests%rowtype;
begin
  if p_actor_id is null or p_actor_role is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select *
  into v_profile
  from public.profiles p
  where p.id = p_actor_id
    and p.role = p_actor_role
    and p.status = 'active';

  if not found or p_actor_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'order confirmation access denied';
  end if;

  if p_actor_role = 'client' and not exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.profile_id = p_actor_id
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

  perform 1
  from public.clients c
  where c.id = p_client_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  if nullif(btrim(p_idempotency_key), '') is not null then
    select *
    into v_existing
    from public.order_confirmation_requests ocr
    where ocr.client_id = p_client_id
      and ocr.idempotency_key = p_idempotency_key
    for update;

    if found then
      return query
      select
        item.order_item_id,
        item.sku_id,
        item.group_id,
        item.group_code,
        item.order_status,
        item.wallet_transaction_id,
        item.product_cost_cny,
        item.estimated_total_bdt,
        item.wallet_balance_cny,
        item.product_base_cost_cny,
        item.grand_estimated_total_bdt,
        item.pending_payment
      from jsonb_to_recordset(v_existing.response_snapshot) as item(
        order_item_id uuid,
        sku_id uuid,
        group_id uuid,
        group_code text,
        order_status public.order_status,
        wallet_transaction_id uuid,
        product_cost_cny numeric(14,2),
        estimated_total_bdt numeric(14,2),
        wallet_balance_cny numeric(14,2),
        product_base_cost_cny numeric(14,2),
        grand_estimated_total_bdt numeric(14,2),
        pending_payment boolean
      );
      return;
    end if;
  end if;

  select *
  into v_product
  from public.product_links pl
  where pl.id = p_product_link_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'product not found';
  end if;

  if v_product.source_status <> 'active' then
    raise exception using errcode = 'P0001', message = 'product availability requires manual review';
  end if;

  select er.cny_to_bdt
  into v_exchange_rate
  from public.exchange_rates er
  where er.effective_on <= current_date
  order by er.effective_on desc, er.created_at desc
  limit 1;

  if v_exchange_rate is null or v_exchange_rate <= 0 then
    raise exception using errcode = 'P0001', message = 'estimate exchange-rate configuration requires manual review';
  end if;

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_sku_id := (v_line ->> 'skuId')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception using errcode = '22023', message = 'each order line requires a positive quantity';
    end if;

    select *
    into v_sku
    from public.product_skus ps
    where ps.id = v_sku_id
      and ps.product_link_id = p_product_link_id
    for update;

    if not found then
      raise exception using errcode = 'P0002', message = 'product SKU not found';
    end if;

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

  select count(*)::integer
  into v_open_count
  from public.order_groups og
  where og.client_id = p_client_id
    and og.status = 'open';

  if v_open_count > 1 then
    raise exception using errcode = 'P0003', message = 'multiple open order groups require manual resolution';
  end if;

  if v_open_count = 1 then
    select *
    into v_group
    from public.order_groups og
    where og.client_id = p_client_id
      and og.status = 'open'
    for update;
  else
    for v_attempt in 1..5 loop
      begin
        insert into public.order_groups (client_id, group_code, status)
        values (
          p_client_id,
          'GRP-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
          'open'
        )
        returning * into v_group;
        exit;
      exception
        when unique_violation then
          if v_attempt = 5 then
            raise;
          end if;
      end;
    end loop;
  end if;

  v_snapshot := jsonb_build_object(
    'version', 2,
    'flow', 'direct_multi_sku_order_confirmation',
    'calculatedAt', now(),
    'inputs', jsonb_build_object(
      'productId', p_product_link_id,
      'lines', p_lines,
      'estimatedUnitWeightKg', p_estimated_unit_weight_kg,
      'internationalShippingCategory', p_international_shipping_category,
      'internationalShippingRateBdtPerKg', p_international_shipping_rate_bdt_per_kg,
      'exchangeRateCnyToBdt', v_exchange_rate
    ),
    'costs', jsonb_build_object(
      'productBaseCostCny', v_product_base_cny,
      'chinaDomesticShippingCny', v_domestic_cny,
      'chinaToGuangzhouCostCny', v_guangzhou_cny,
      'serviceChargeCny', v_service_cny,
      'totalCnyCost', v_total_cny,
      'convertedCnyCostBdt', v_converted_cny_bdt,
      'internationalShippingBdt', v_international_bdt,
      'grandEstimatedTotalBdt', v_grand_total_bdt
    ),
    'disclaimer', 'Estimated cost may change after actual weight, seller payment, and courier cost are known.'
  );

  for v_line in select * from jsonb_array_elements(p_lines) loop
    v_line_index := v_line_index + 1;
    v_sku_id := (v_line ->> 'skuId')::uuid;
    v_quantity := (v_line ->> 'quantity')::integer;

    select *
    into v_sku
    from public.product_skus ps
    where ps.id = v_sku_id
      and ps.product_link_id = p_product_link_id
    for update;

    v_line_product_cost := round(v_sku.price_cny * v_quantity, 2);
    v_line_weight := round(p_estimated_unit_weight_kg * v_quantity, 3);
    v_line_domestic_cny := round(v_line_weight * 4, 2);
    v_line_guangzhou_cny := round(v_line_weight * 4, 2);
    v_line_service_cny := round(v_line_product_cost * 0.06, 2);
    v_line_international_bdt := round(v_line_weight * p_international_shipping_rate_bdt_per_kg, 2);
    v_line_estimated_total_bdt := ceil((v_line_product_cost + v_line_domestic_cny + v_line_guangzhou_cny + v_line_service_cny) * v_exchange_rate) + v_line_international_bdt;

    insert into public.order_items (
      client_id,
      group_id,
      estimate_id,
      product_link_id,
      product_sku_id,
      sku_id,
      quantity,
      cny_price,
      domestic_delivery_cny,
      estimated_weight_kg,
      category,
      estimated_total_bdt,
      actual_total_bdt,
      admin_notes,
      client_notes,
      wallet_reserved_cny,
      wallet_uncovered_cny,
      product_cost_cny,
      china_to_guangzhou_cny,
      service_charge_cny,
      international_shipping_bdt,
      cost_snapshot,
      status
    )
    values (
      p_client_id,
      v_group.id,
      null,
      p_product_link_id,
      v_sku.id,
      v_sku.id::text,
      v_quantity,
      v_sku.price_cny,
      v_line_domestic_cny,
      v_line_weight,
      coalesce(v_product.category, 'default'),
      v_line_estimated_total_bdt,
      null,
      null,
      null,
      0,
      0,
      v_line_product_cost,
      v_line_guangzhou_cny,
      v_line_service_cny,
      v_line_international_bdt,
      v_snapshot || jsonb_build_object(
        'line', jsonb_build_object(
          'skuId', v_sku.id,
          'providerSkuId', v_sku.provider_sku_id,
          'label', v_sku.label,
          'quantity', v_quantity,
          'unitPriceCny', v_sku.price_cny,
          'productCostCny', v_line_product_cost,
          'estimatedWeightKg', v_line_weight,
          'chinaDomesticShippingCny', v_line_domestic_cny,
          'chinaToGuangzhouCostCny', v_line_guangzhou_cny,
          'serviceChargeCny', v_line_service_cny,
          'internationalShippingBdt', v_line_international_bdt,
          'estimatedTotalBdt', v_line_estimated_total_bdt
        )
      ),
      'pending_admin_review'
    )
    returning * into v_order;

    v_wallet_tx := null;
    select coalesce(sum(wt.amount_cny), 0)::numeric(14,2)
    into v_previous_balance
    from public.wallet_transactions wt
    where wt.client_id = p_client_id
      and wt.status = 'posted';

    v_wallet_balance := round(v_previous_balance - v_line_product_cost, 2);

    if v_line_product_cost > 0 then
      insert into public.wallet_transactions (
        client_id,
        transaction_type,
        amount_bdt,
        amount_cny,
        cny_to_bdt_rate,
        running_balance_cny,
        status,
        notes,
        approved_by,
        payment_proof_id,
        order_item_id,
        order_group_id,
        product_link_id,
        created_by,
        reservation_transaction_id
      )
      values (
        p_client_id,
        'order_debit',
        -round(v_line_product_cost * v_exchange_rate, 2),
        -v_line_product_cost,
        v_exchange_rate,
        v_wallet_balance,
        'posted',
        'Product base cost debited when customer confirmed order',
        null,
        null,
        v_order.id,
        v_group.id,
        p_product_link_id,
        p_actor_id,
        null
      )
      returning * into v_wallet_tx;
    end if;

    v_response := v_response || jsonb_build_array(jsonb_build_object(
      'order_item_id', v_order.id,
      'sku_id', v_sku.id,
      'group_id', v_group.id,
      'group_code', v_group.group_code,
      'order_status', v_order.status,
      'wallet_transaction_id', case when v_wallet_tx.id is null then null else v_wallet_tx.id end,
      'product_cost_cny', v_line_product_cost,
      'estimated_total_bdt', v_line_estimated_total_bdt,
      'wallet_balance_cny', v_wallet_balance,
      'product_base_cost_cny', v_product_base_cny,
      'grand_estimated_total_bdt', v_grand_total_bdt,
      'pending_payment', v_wallet_balance < 0
    ));
  end loop;

  if nullif(btrim(p_idempotency_key), '') is not null then
    insert into public.order_confirmation_requests (
      client_id,
      idempotency_key,
      product_link_id,
      group_id,
      request_snapshot,
      response_snapshot
    )
    values (
      p_client_id,
      p_idempotency_key,
      p_product_link_id,
      v_group.id,
      jsonb_build_object(
        'actorId', p_actor_id,
        'actorRole', p_actor_role,
        'productId', p_product_link_id,
        'lines', p_lines,
        'estimatedUnitWeightKg', p_estimated_unit_weight_kg,
        'internationalShippingCategory', p_international_shipping_category
      ),
      v_response
    );
  end if;

  return query
  select
    item.order_item_id,
    item.sku_id,
    item.group_id,
    item.group_code,
    item.order_status,
    item.wallet_transaction_id,
    item.product_cost_cny,
    item.estimated_total_bdt,
    item.wallet_balance_cny,
    item.product_base_cost_cny,
    item.grand_estimated_total_bdt,
    item.pending_payment
  from jsonb_to_recordset(v_response) as item(
    order_item_id uuid,
    sku_id uuid,
    group_id uuid,
    group_code text,
    order_status public.order_status,
    wallet_transaction_id uuid,
    product_cost_cny numeric(14,2),
    estimated_total_bdt numeric(14,2),
    wallet_balance_cny numeric(14,2),
    product_base_cost_cny numeric(14,2),
    grand_estimated_total_bdt numeric(14,2),
    pending_payment boolean
  );
end;
$$;

revoke all on function public.confirm_multi_sku_order(
  uuid,
  public.user_role,
  uuid,
  uuid,
  jsonb,
  numeric,
  text,
  numeric,
  text
) from public, anon, authenticated;

grant execute on function public.confirm_multi_sku_order(
  uuid,
  public.user_role,
  uuid,
  uuid,
  jsonb,
  numeric,
  text,
  numeric,
  text
) to service_role;

commit;
