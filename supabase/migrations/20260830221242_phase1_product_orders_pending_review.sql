begin;

-- A product order is the immutable client-submission boundary. SKU-level
-- order_items remain the financial and fulfillment source of truth.
create table public.product_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  client_id uuid not null references public.clients(id) on delete restrict,
  product_link_id uuid not null references public.product_links(id) on delete restrict,
  submission_key text not null,
  created_at timestamptz not null default now(),
  unique (client_id, product_link_id, submission_key)
);

create index product_orders_client_created_idx
  on public.product_orders (client_id, created_at desc);
create index product_orders_product_created_idx
  on public.product_orders (product_link_id, created_at desc);

alter table public.product_orders enable row level security;
revoke all on table public.product_orders from public, anon;
grant select on table public.product_orders to authenticated;

create policy product_orders_select_own_or_admin
on public.product_orders for select to authenticated
using (
  ((select public.current_user_role()) = 'client'
    and client_id in (select id from public.clients where profile_id = (select auth.uid())))
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

alter table public.order_items
  add column if not exists product_order_id uuid references public.product_orders(id) on delete restrict;

-- Direct multi-SKU confirmations already persist a shared calculatedAt value.
-- Use that value to safely attach all lines from one submission, while every
-- unmatched historical line gets its own aggregate and can never merge later.
insert into public.product_orders (order_number, client_id, product_link_id, submission_key, created_at)
select
  'PORD-' || upper(replace(gen_random_uuid()::text, '-', '')),
  ocr.client_id,
  ocr.product_link_id,
  'confirmation:' || ocr.id::text,
  ocr.created_at
from public.order_confirmation_requests ocr
on conflict (client_id, product_link_id, submission_key) do nothing;

with confirmation_lines as (
  select
    ocr.client_id,
    ocr.product_link_id,
    'confirmation:' || ocr.id::text as submission_key,
    (line ->> 'order_item_id')::uuid as order_item_id
  from public.order_confirmation_requests ocr
  cross join lateral jsonb_array_elements(ocr.response_snapshot) as line
  where nullif(line ->> 'order_item_id', '') is not null
)
update public.order_items oi
set product_order_id = po.id
from confirmation_lines cl
join public.product_orders po
  on po.client_id = cl.client_id
 and po.product_link_id = cl.product_link_id
 and po.submission_key = cl.submission_key
where oi.id = cl.order_item_id
  and oi.product_order_id is null;

insert into public.product_orders (order_number, client_id, product_link_id, submission_key, created_at)
select
  'PORD-' || upper(replace(gen_random_uuid()::text, '-', '')),
  oi.client_id,
  oi.product_link_id,
  'legacy:' || oi.id::text,
  oi.created_at
from public.order_items oi
where oi.product_order_id is null
on conflict (client_id, product_link_id, submission_key) do nothing;

update public.order_items oi
set product_order_id = po.id
from public.product_orders po
where oi.product_order_id is null
  and po.client_id = oi.client_id
  and po.product_link_id = oi.product_link_id
  and po.submission_key = 'legacy:' || oi.id::text;

alter table public.order_items
  alter column product_order_id set not null;

create index order_items_product_order_id_idx
  on public.order_items (product_order_id, created_at);

create or replace function private.assign_product_order_on_order_item_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_submission_key text;
begin
  if new.product_order_id is not null then
    return new;
  end if;

  v_submission_key := coalesce(
    nullif(new.cost_snapshot #>> '{calculatedAt}', ''),
    'legacy:' || new.id::text
  );

  insert into public.product_orders (
    order_number, client_id, product_link_id, submission_key, created_at
  ) values (
    'PORD-' || upper(replace(gen_random_uuid()::text, '-', '')),
    new.client_id,
    new.product_link_id,
    v_submission_key,
    coalesce(new.created_at, now())
  )
  on conflict (client_id, product_link_id, submission_key)
  do update set submission_key = excluded.submission_key
  returning id into new.product_order_id;

  return new;
end;
$$;

revoke all on function private.assign_product_order_on_order_item_insert() from public, anon;

drop trigger if exists order_items_assign_product_order on public.order_items;
create trigger order_items_assign_product_order
before insert on public.order_items
for each row execute function private.assign_product_order_on_order_item_insert();

create or replace function public.confirm_product_order_for_purchase(
  p_product_order_id uuid
)
returns table (
  product_order_id uuid,
  purchase_batch_id uuid,
  order_item_ids uuid[],
  order_status public.order_status
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_product_order public.product_orders%rowtype;
  v_line record;
  v_batch public.purchase_batches%rowtype;
  v_existing_batch_id uuid;
  v_order_item_id uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_count integer := 0;
  v_pending integer := 0;
  v_confirmed integer := 0;
  v_queued integer := 0;
begin
  if v_actor is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  select * into v_product_order
  from public.product_orders
  where id = p_product_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'product order not found';
  end if;

  for v_line in
    select id, status
    from public.order_items
    where product_order_id = p_product_order_id
    order by id
    for update
  loop
    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_line.id);
    if v_line.status = 'pending_admin_review' then v_pending := v_pending + 1; end if;
    if v_line.status = 'confirmed' then v_confirmed := v_confirmed + 1; end if;
    if v_line.status = 'queued_for_purchase' then v_queued := v_queued + 1; end if;
  end loop;

  if v_count = 0 then
    raise exception using errcode = 'P0002', message = 'product order has no SKU lines';
  end if;

  if v_queued = v_count then
    select pbi.purchase_batch_id into v_existing_batch_id
    from public.purchase_batch_items pbi
    where pbi.order_item_id = any(v_ids)
    order by pbi.created_at desc
    limit 1;
    if v_existing_batch_id is null then
      raise exception using errcode = 'P0001', message = 'queued product order is missing its purchase batch';
    end if;
    return query select p_product_order_id, v_existing_batch_id, v_ids, 'queued_for_purchase'::public.order_status;
    return;
  end if;

  if v_pending <> 0 and v_pending <> v_count then
    raise exception using errcode = '23514', message = 'product order has mixed SKU statuses and cannot be confirmed';
  end if;
  if v_pending = 0 and v_confirmed <> v_count then
    raise exception using errcode = '23514', message = 'only pending or fully confirmed product orders can enter purchasing';
  end if;

  if v_pending = v_count then
    foreach v_order_item_id in array v_ids loop
      perform private.change_order_status_internal(
        v_order_item_id,
        'confirmed',
        'approved with every SKU in product order'
      );
    end loop;
  end if;

  insert into public.purchase_batches (batch_code, status, created_by)
  values (
    'PB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    'sent_to_extension',
    v_actor
  )
  returning * into v_batch;

  foreach v_order_item_id in array v_ids loop
    insert into public.purchase_batch_items (purchase_batch_id, order_item_id, status)
    values (v_batch.id, v_order_item_id, 'queued');
    perform private.change_order_status_internal(
      v_order_item_id,
      'queued_for_purchase',
      'queued with every SKU in product order for extension-assisted purchase'
    );
  end loop;

  return query select p_product_order_id, v_batch.id, v_ids, 'queued_for_purchase'::public.order_status;
end;
$$;

revoke all on function public.confirm_product_order_for_purchase(uuid) from public, anon;
grant execute on function public.confirm_product_order_for_purchase(uuid) to authenticated, service_role;

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
      select oi.id, oi.product_order_id, oi.quantity, oi.cny_price, oi.domestic_delivery_cny,
        oi.international_shipping_bdt, oi.estimated_total_bdt, oi.actual_total_bdt,
        oi.status, oi.created_at, oi.client_notes,
        coalesce(oi.product_cost_cny, round(oi.cny_price * oi.quantity, 2)) as supplier_cost_cny,
        oi.wallet_required_cny, oi.wallet_reserved_cny, oi.wallet_uncovered_cny,
        oi.wallet_committed_cny, oi.wallet_committed_at, oi.wallet_rate_cny_to_bdt,
        coalesce(oi.wallet_rate_cny_to_bdt,
          nullif(oi.cost_snapshot #>> '{inputs,exchangeRateCnyToBdt}', '')::numeric,
          est.exchange_rate_cny_to_bdt) as exchange_rate,
        poa.order_number as product_order_number,
        pl.provider_item_id as product_id, left(pl.title, 180) as short_description,
        pl.images as product_images, pl.original_url as product_url,
        ps.label as sku_description, ps.attributes as sku_attributes,
        ps.image_url as sku_image_url, ps.price_cny as sku_price_cny,
        provider.provider, provider.provider_order_id,
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
      join public.product_orders poa on poa.id = oi.product_order_id
      join public.product_links pl on pl.id = oi.product_link_id
      left join public.product_skus ps on ps.id = oi.product_sku_id
      left join public.estimates est on est.id = oi.estimate_id
      left join lateral (
        select p.provider, p.provider_order_id
        from public.provider_orders p where p.order_item_id = oi.id
        order by p.synced_at desc nulls last, p.created_at desc, p.id desc limit 1
      ) provider on true
      where oi.client_id = v_client_id
    ), grouped as (
      select product_order_id::text as order_key, max(product_order_number) as product_order_number,
        max(provider_order_id) as provider_order_number, max(provider) as store_name,
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
          'color', coalesce(sku_attributes->>'color', sku_attributes->>'Color', sku_attributes->>'é¢œè‰²'),
          'size', coalesce(sku_attributes->>'size', sku_attributes->>'Size', sku_attributes->>'å°ºç ', sku_attributes->>'å°ºå¯¸', sku_attributes->>'äº§å“è§„æ ¼'),
          'unitPriceCny', coalesce(sku_price_cny, cny_price), 'quantity', quantity,
          'subtotalCny', round(coalesce(sku_price_cny, cny_price) * quantity, 2),
          'subtotalBdt', case when exchange_rate is not null then round(coalesce(sku_price_cny, cny_price) * quantity * exchange_rate, 2) end,
          'shippingFeeCny', domestic_delivery_cny,
          'shippingFeeBdt', international_shipping_bdt, 'status', status, 'note', client_notes
        ) order by created_at, id) as skus
      from source_lines
      group by product_order_id
    )
    select jsonb_build_object('orders', coalesce(jsonb_agg(jsonb_build_object(
      'orderId', order_key, 'productId', product_id,
      'providerOrderNumber', provider_order_number,
      'displayOrderNumber', coalesce(provider_order_number, product_order_number),
      'orderedAt', ordered_at,
      'product', jsonb_build_object('imageUrl', product_images[1], 'productUrl', product_url,
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
