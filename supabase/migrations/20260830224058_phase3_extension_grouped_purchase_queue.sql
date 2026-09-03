begin;

-- Version 2 is intentionally one row per SKU here: the API groups these rows
-- into one task payload while retaining each SKU line as an auditable unit.
create or replace function public.get_extension_purchase_queue_v2()
returns table (
  purchase_task_id uuid,
  product_order_id uuid,
  purchase_batch_id uuid,
  order_number text,
  provider text,
  product_url text,
  provider_item_id text,
  product_title text,
  product_image text,
  order_item_id uuid,
  provider_sku_id text,
  sku_label text,
  attributes jsonb,
  quantity integer,
  expected_unit_price_cny numeric(14,2),
  expected_domestic_delivery_cny numeric(14,2)
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return query
  select
    pt.id, po.id, pt.purchase_batch_id, po.order_number,
    pl.provider, pl.original_url, pl.provider_item_id, pl.title,
    coalesce(ps.image_url, pl.images[1]), oi.id, ps.provider_sku_id,
    coalesce(ps.label, oi.sku_id), coalesce(ps.attributes, '{}'::jsonb),
    oi.quantity, oi.cny_price::numeric(14,2), oi.domestic_delivery_cny::numeric(14,2)
  from public.purchase_tasks pt
  join public.product_orders po on po.id = pt.product_order_id
  join public.product_links pl on pl.id = po.product_link_id
  join public.order_items oi on oi.product_order_id = po.id
  left join public.product_skus ps on ps.id = oi.product_sku_id
  where pt.state = 'queued'
    and oi.status = 'queued_for_purchase'
    and not exists (
      select 1 from public.order_items incomplete
      where incomplete.product_order_id = po.id
        and incomplete.status <> 'queued_for_purchase'
    )
  order by pt.created_at asc, oi.created_at asc, oi.id asc;
end;
$$;

revoke all on function public.get_extension_purchase_queue_v2() from public, anon;
grant execute on function public.get_extension_purchase_queue_v2() to authenticated, service_role;

create or replace function public.get_extension_purchase_queue_v2_for_credential(p_profile_id uuid)
returns table (
  purchase_task_id uuid, product_order_id uuid, purchase_batch_id uuid, order_number text,
  provider text, product_url text, provider_item_id text, product_title text, product_image text,
  order_item_id uuid, provider_sku_id text, sku_label text, attributes jsonb, quantity integer,
  expected_unit_price_cny numeric(14,2), expected_domestic_delivery_cny numeric(14,2)
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.get_extension_purchase_queue_v2();
end;
$$;

revoke all on function public.get_extension_purchase_queue_v2_for_credential(uuid) from public, anon, authenticated;
grant execute on function public.get_extension_purchase_queue_v2_for_credential(uuid) to service_role;

commit;
