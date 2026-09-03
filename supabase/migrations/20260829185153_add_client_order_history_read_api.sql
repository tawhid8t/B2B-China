-- Client-safe SKU order history. Product snapshots remain private; this
-- function exposes only fields required by the existing client Orders page.
begin;

create or replace function public.get_client_order_history()
returns table (
  id uuid,
  quantity integer,
  cny_price numeric(12,2),
  product_cost_cny numeric(14,2),
  estimated_total_bdt numeric(14,2),
  status public.order_status,
  created_at timestamptz,
  product_title text,
  product_images text[],
  product_original_url text,
  sku_label text,
  sku_image_url text,
  sku_price_cny numeric(12,2)
)
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

  select c.id into v_client_id
  from public.clients c
  where c.profile_id = (select auth.uid());

  if v_client_id is null then return; end if;

  return query
  select oi.id, oi.quantity, oi.cny_price, oi.product_cost_cny, oi.estimated_total_bdt,
    oi.status, oi.created_at, pl.title, pl.images, pl.original_url, ps.label, ps.image_url, ps.price_cny
  from public.order_items oi
  join public.product_links pl on pl.id = oi.product_link_id
  join public.product_skus ps on ps.id = oi.product_sku_id
  where oi.client_id = v_client_id
  order by oi.created_at desc, oi.id
  limit 100;
end;
$$;

revoke all on function public.get_client_order_history() from public, anon;
grant execute on function public.get_client_order_history() to authenticated;

commit;
