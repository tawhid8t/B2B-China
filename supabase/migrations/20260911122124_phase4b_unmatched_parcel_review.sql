-- An admin may make a deliberate, audited item association for a Cainiao
-- parcel that was not matched by its tracking number.  This never changes
-- purchase/financial state and does not claim parcel-specific quantity.
create or replace function public.get_cainiao_unmatched_link_candidates()
returns table (
  order_item_id uuid,
  provider_order_id text,
  product_title text,
  product_image text,
  sku_label text,
  quantity integer,
  client_business_name text
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return query
  select distinct on (oi.id)
    oi.id, po.provider_order_id, pl.title, coalesce(ps.image_url, pl.images[1]),
    coalesce(ps.label, oi.sku_id), oi.quantity, c.business_name
  from public.provider_orders po
  join public.order_items oi on oi.id = po.order_item_id
  join public.product_links pl on pl.id = oi.product_link_id
  left join public.product_skus ps on ps.id = oi.product_sku_id
  join public.clients c on c.id = oi.client_id
  where po.provider = 'alibaba1688'
    and po.provider_order_id is not null
    and oi.status in ('purchased', 'seller_shipped')
  order by oi.id, po.purchased_at desc nulls last, po.created_at desc;
end;
$$;

revoke all on function public.get_cainiao_unmatched_link_candidates() from public, anon;
grant execute on function public.get_cainiao_unmatched_link_candidates() to authenticated, service_role;

create or replace function public.link_cainiao_unmatched_parcel(
  p_tracking_number text,
  p_order_item_id uuid,
  p_reason text
)
returns table (parcel_id uuid, tracking_number text, order_item_id uuid, linked_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_tracking text := upper(regexp_replace(btrim(coalesce(p_tracking_number, '')), '\\s+', '', 'g'));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_parcel public.parcels%rowtype;
  v_before jsonb;
  v_existing_item uuid;
begin
  if v_actor is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if v_tracking !~ '^[A-Z0-9-]{6,64}$' then
    raise exception using errcode = '22023', message = 'invalid parcel tracking number';
  end if;
  if p_order_item_id is null or v_reason is null or char_length(v_reason) > 500 then
    raise exception using errcode = '22023', message = 'an order item and a 1–500 character linking reason are required';
  end if;

  select * into v_parcel
  from public.parcels p
  where upper(regexp_replace(btrim(p.tracking_number), '\\s+', '', 'g')) = v_tracking
    and p.source in ('manual', 'screenshot')
  for update;
  if not found then raise exception using errcode = 'P0002', message = 'Cainiao parcel not found'; end if;
  if not exists (
    select 1 from public.provider_orders po
    join public.order_items oi on oi.id = po.order_item_id
    where po.provider = 'alibaba1688' and po.provider_order_id is not null
      and oi.id = p_order_item_id and oi.status in ('purchased', 'seller_shipped')
  ) then raise exception using errcode = '22023', message = 'select an eligible purchased provider order item'; end if;

  select pi.order_item_id into v_existing_item from public.parcel_items pi where pi.parcel_id = v_parcel.id limit 1;
  if v_parcel.unmatched_review_status = 'linked' and v_existing_item is distinct from p_order_item_id then
    raise exception using errcode = '23514', message = 'parcel is already linked; use a future correction workflow to change it';
  end if;

  v_before := to_jsonb(v_parcel);
  insert into public.parcel_items (parcel_id, order_item_id) values (v_parcel.id, p_order_item_id)
  on conflict (parcel_id, order_item_id) do nothing;
  update public.parcels
  set unmatched_review_status = 'linked', unmatched_reviewed_by = v_actor,
      unmatched_reviewed_at = now(), unmatched_review_reason = v_reason
  where id = v_parcel.id
  returning * into v_parcel;
  perform private.write_audit_log_internal('parcel', v_parcel.id, 'cainiao_parcel_manually_linked', v_before,
    jsonb_build_object('tracking_number', v_parcel.tracking_number, 'order_item_id', p_order_item_id, 'reason', v_reason), null);
  return query select v_parcel.id, v_parcel.tracking_number, p_order_item_id, v_parcel.unmatched_reviewed_at;
end;
$$;

revoke all on function public.link_cainiao_unmatched_parcel(text, uuid, text) from public, anon;
grant execute on function public.link_cainiao_unmatched_parcel(text, uuid, text) to authenticated, service_role;
