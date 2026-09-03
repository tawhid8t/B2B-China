-- Add actual provider-purchase facts without altering estimate or product snapshots.
-- Recovery: all changes are additive; values remain nullable for historical rows.
begin;

alter table public.provider_orders
  add column if not exists provider_sku_id text,
  add column if not exists quantity_purchased integer,
  add column if not exists actual_unit_price_cny numeric(14,2),
  add column if not exists actual_product_subtotal_cny numeric(14,2),
  add column if not exists actual_domestic_delivery_cny numeric(14,2),
  add column if not exists actual_discount_cny numeric(14,2),
  add column if not exists purchased_at timestamptz;

alter table public.provider_orders
  add constraint provider_orders_quantity_purchased_positive
    check (quantity_purchased is null or quantity_purchased > 0),
  add constraint provider_orders_actual_unit_price_nonnegative
    check (actual_unit_price_cny is null or actual_unit_price_cny >= 0),
  add constraint provider_orders_actual_product_subtotal_nonnegative
    check (actual_product_subtotal_cny is null or actual_product_subtotal_cny >= 0),
  add constraint provider_orders_actual_domestic_delivery_nonnegative
    check (actual_domestic_delivery_cny is null or actual_domestic_delivery_cny >= 0),
  add constraint provider_orders_actual_discount_nonnegative
    check (actual_discount_cny is null or actual_discount_cny >= 0);

create or replace function public.get_extension_purchase_queue()
returns table (
  order_item_id uuid,
  purchase_batch_id uuid,
  provider text,
  product_url text,
  provider_item_id text,
  provider_sku_id text,
  sku_label text,
  attributes jsonb,
  quantity integer,
  expected_unit_price_cny numeric(14,2),
  expected_domestic_delivery_cny numeric(14,2),
  product_image text
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return query
  select oi.id, pbi.purchase_batch_id, pl.provider, pl.original_url,
    pl.provider_item_id, ps.provider_sku_id, coalesce(ps.label, oi.sku_id),
    coalesce(ps.attributes, '{}'::jsonb), oi.quantity, oi.cny_price::numeric(14,2),
    oi.domestic_delivery_cny::numeric(14,2), coalesce(ps.image_url, pl.images[1])
  from public.purchase_batch_items pbi
  join public.purchase_batches pb on pb.id = pbi.purchase_batch_id
  join public.order_items oi on oi.id = pbi.order_item_id
  join public.product_links pl on pl.id = oi.product_link_id
  left join public.product_skus ps on ps.id = oi.product_sku_id
  where oi.status = 'queued_for_purchase'
    and pbi.status = 'queued'
    and pb.status in ('sent_to_extension', 'partially_purchased');
end;
$$;

revoke all on function public.get_extension_purchase_queue() from public, anon;
grant execute on function public.get_extension_purchase_queue() to authenticated, service_role;

create or replace function public.queue_order_for_purchase(p_order_item_id uuid)
returns table (purchase_batch_id uuid, order_item_id uuid, order_item_status public.order_status)
language plpgsql security invoker set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.order_items%rowtype;
  v_batch public.purchase_batches%rowtype;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  select * into v_order from public.order_items where id = p_order_item_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'order item not found'; end if;
  if v_order.status <> 'confirmed' then
    raise exception using errcode = '23514', message = 'only confirmed orders can be queued for purchase';
  end if;
  insert into public.purchase_batches (batch_code, status, created_by)
  values ('PB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), 'sent_to_extension', v_actor)
  returning * into v_batch;
  insert into public.purchase_batch_items (purchase_batch_id, order_item_id, status)
  values (v_batch.id, v_order.id, 'queued');
  v_order := private.change_order_status_internal(v_order.id, 'queued_for_purchase', 'queued for extension-assisted purchase');
  return query select v_batch.id, v_order.id, v_order.status;
end;
$$;

revoke all on function public.queue_order_for_purchase(uuid) from public, anon;
grant execute on function public.queue_order_for_purchase(uuid) to authenticated, service_role;

create or replace function public.sync_provider_order_and_commit_wallet_v2(
  p_order_item_id uuid, p_provider text, p_provider_order_id text, p_paid_amount_cny numeric,
  p_seller_tracking_number text, p_provider_status text, p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null, p_purchase_batch_id uuid default null,
  p_provider_sku_id text default null, p_quantity_purchased integer default null,
  p_actual_unit_price_cny numeric default null, p_actual_product_subtotal_cny numeric default null,
  p_actual_domestic_delivery_cny numeric default null, p_actual_discount_cny numeric default null,
  p_purchased_at timestamptz default null
)
returns table (provider_order_record_id uuid, order_item_status public.order_status, synced_at timestamptz,
  reservation_transaction_id uuid, release_transaction_id uuid, debit_transaction_id uuid,
  debited_amount_cny numeric(14,2), uncovered_amount_cny numeric(14,2), applied_rate numeric(10,4))
language plpgsql security invoker set search_path = ''
as $$
declare v_result record; v_provider_order public.provider_orders%rowtype; v_batch_id uuid; v_order public.order_items%rowtype;
begin
  if public.current_user_role() not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'admin role required'; end if;
  select * into v_order from public.order_items where id = p_order_item_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'order item not found'; end if;
  if v_order.status not in ('queued_for_purchase', 'purchased') then raise exception using errcode = '23514', message = 'order is not eligible for provider purchase sync'; end if;
  if p_purchase_batch_id is not null then
    if not exists (select 1 from public.purchase_batch_items where purchase_batch_id = p_purchase_batch_id and order_item_id = p_order_item_id) then raise exception using errcode = '23514', message = 'purchase batch does not contain this order item'; end if;
    v_batch_id := p_purchase_batch_id;
  else
    select purchase_batch_id into v_batch_id from public.purchase_batch_items where order_item_id = p_order_item_id order by created_at desc limit 1;
  end if;
  -- Keep seller tracking as provider data; this phase deliberately stops at purchased.
  select * into v_result from private.sync_provider_order_and_commit_wallet_internal(p_order_item_id, p_provider, p_provider_order_id, p_paid_amount_cny, null, p_provider_status, p_raw_payload, p_cny_to_bdt_rate);
  update public.provider_orders set purchase_batch_id = coalesce(v_batch_id, purchase_batch_id), seller_tracking_number = coalesce(nullif(btrim(p_seller_tracking_number), ''), seller_tracking_number), provider_sku_id = coalesce(nullif(btrim(p_provider_sku_id), ''), provider_sku_id), quantity_purchased = coalesce(p_quantity_purchased, quantity_purchased), actual_unit_price_cny = coalesce(p_actual_unit_price_cny, actual_unit_price_cny), actual_product_subtotal_cny = coalesce(p_actual_product_subtotal_cny, actual_product_subtotal_cny), actual_domestic_delivery_cny = coalesce(p_actual_domestic_delivery_cny, actual_domestic_delivery_cny), actual_discount_cny = coalesce(p_actual_discount_cny, actual_discount_cny), purchased_at = coalesce(p_purchased_at, purchased_at, v_result.synced_at)
  where id = v_result.provider_order_record_id returning * into v_provider_order;
  if v_batch_id is not null then
    update public.purchase_batch_items set status = 'purchased' where purchase_batch_id = v_batch_id and order_item_id = p_order_item_id;
    update public.purchase_batches set status = case when exists (select 1 from public.purchase_batch_items where purchase_batch_id = v_batch_id and status <> 'purchased') then 'partially_purchased'::public.purchase_batch_status else 'purchased'::public.purchase_batch_status end where id = v_batch_id;
  end if;
  return query select v_result.provider_order_record_id, v_result.order_item_status, v_result.synced_at, v_result.reservation_transaction_id, v_result.release_transaction_id, v_result.debit_transaction_id, v_result.debited_amount_cny, v_result.uncovered_amount_cny, v_result.applied_rate;
end;
$$;

revoke all on function public.sync_provider_order_and_commit_wallet_v2(uuid, text, text, numeric, text, text, jsonb, numeric, uuid, text, integer, numeric, numeric, numeric, numeric, timestamptz) from public, anon;
grant execute on function public.sync_provider_order_and_commit_wallet_v2(uuid, text, text, numeric, text, text, jsonb, numeric, uuid, text, integer, numeric, numeric, numeric, numeric, timestamptz) to authenticated, service_role;

commit;
