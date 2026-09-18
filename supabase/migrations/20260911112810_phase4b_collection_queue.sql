-- Mobile collection queue. It reads canonical parcels and parcel_items; it
-- intentionally does not mark an order item received or perform QC.
create or replace function private.get_cainiao_collection_queue_internal()
returns table (
  parcel_id uuid,
  tracking_number text,
  parcel_status public.parcel_status,
  source_status text,
  pickup_code text,
  carrier text,
  pickup_station text,
  source_arrived_at timestamptz,
  source_expected_arrival_at timestamptz,
  source_last_tracking_update_at timestamptz,
  collected_at timestamptz,
  assigned_staff_id uuid,
  unmatched_review_status text,
  order_item_id uuid,
  client_business_name text,
  product_title text,
  product_images text[],
  sku_label text,
  expected_order_quantity integer,
  expected_pieces integer,
  order_status public.order_status
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  v_role := private.current_user_role();
  if auth.uid() is null or v_role not in ('staff_receiver', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'receiving access required';
  end if;

  return query
  select
    p.id,
    p.tracking_number,
    p.status,
    p.source_status,
    p.pickup_code,
    p.carrier,
    p.pickup_station,
    p.source_arrived_at,
    p.source_expected_arrival_at,
    p.source_last_tracking_update_at,
    p.collected_at,
    p.assigned_staff_id,
    p.unmatched_review_status,
    oi.id,
    c.business_name,
    pl.title,
    pl.images,
    ps.label,
    oi.quantity,
    coalesce(pi.expected_pieces, p.expected_pieces),
    oi.status
  from public.parcels p
  left join public.parcel_items pi on pi.parcel_id = p.id
  left join public.order_items oi on oi.id = coalesce(pi.order_item_id, p.order_item_id)
  left join public.clients c on c.id = oi.client_id
  left join public.product_links pl on pl.id = oi.product_link_id
  left join public.product_skus ps on ps.id = oi.product_sku_id
  where p.source in ('manual', 'screenshot')
    and p.unmatched_review_status <> 'archived'
    and (
      v_role in ('admin', 'super_admin')
      or p.assigned_staff_id is null
      or p.assigned_staff_id = auth.uid()
    )
  order by
    case p.status
      when 'delivered' then 0
      when 'in_transit' then 1
      when 'received' then 2
      else 3
    end,
    p.source_arrived_at desc nulls last,
    p.created_at desc;
end;
$$;

revoke all on function private.get_cainiao_collection_queue_internal() from public, anon, authenticated;
grant execute on function private.get_cainiao_collection_queue_internal() to authenticated, service_role;

create or replace function public.get_cainiao_collection_queue()
returns table (
  parcel_id uuid,
  tracking_number text,
  parcel_status public.parcel_status,
  source_status text,
  pickup_code text,
  carrier text,
  pickup_station text,
  source_arrived_at timestamptz,
  source_expected_arrival_at timestamptz,
  source_last_tracking_update_at timestamptz,
  collected_at timestamptz,
  assigned_staff_id uuid,
  unmatched_review_status text,
  order_item_id uuid,
  client_business_name text,
  product_title text,
  product_images text[],
  sku_label text,
  expected_order_quantity integer,
  expected_pieces integer,
  order_status public.order_status
)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_cainiao_collection_queue_internal()
$$;

revoke all on function public.get_cainiao_collection_queue() from public, anon;
grant execute on function public.get_cainiao_collection_queue() to authenticated, service_role;
