-- Additive, append-only corrections for verified order facts. Existing
-- provider, estimate, wallet, and warehouse records remain authoritative
-- inputs; this table records only an administrator's manual confirmation.
begin;

create table public.order_actual_details (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  product_amount_cny numeric(14,2),
  local_delivery_cny numeric(14,2),
  weight_kg numeric(14,3),
  admin_note text,
  reason text not null check (nullif(btrim(reason), '') is not null),
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (product_amount_cny is null or product_amount_cny >= 0),
  check (local_delivery_cny is null or local_delivery_cny >= 0),
  check (weight_kg is null or weight_kg > 0),
  check (
    product_amount_cny is not null
    or local_delivery_cny is not null
    or weight_kg is not null
    or nullif(btrim(admin_note), '') is not null
  )
);

create index order_actual_details_order_item_created_idx
  on public.order_actual_details (order_item_id, created_at desc);

alter table public.order_actual_details enable row level security;

revoke all on table public.order_actual_details from public, anon;
grant select, insert on table public.order_actual_details to authenticated;

create policy order_actual_details_admin_select
on public.order_actual_details for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy order_actual_details_admin_insert
on public.order_actual_details for insert to authenticated
with check (
  (select public.current_user_role()) in ('admin', 'super_admin')
  and recorded_by = (select auth.uid())
);

create or replace function public.record_order_actual_details(
  p_order_item_id uuid,
  p_product_amount_cny numeric default null,
  p_local_delivery_cny numeric default null,
  p_weight_kg numeric default null,
  p_admin_note text default null,
  p_reason text default null
)
returns table (
  actual_detail_id uuid,
  order_item_id uuid,
  product_amount_cny numeric(14,2),
  local_delivery_cny numeric(14,2),
  weight_kg numeric(14,3),
  admin_note text,
  recorded_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_order public.order_items%rowtype;
  v_previous public.order_actual_details%rowtype;
  v_record public.order_actual_details%rowtype;
begin
  if v_actor is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'a reason is required for actual-detail changes';
  end if;
  if p_product_amount_cny is null and p_local_delivery_cny is null and p_weight_kg is null
    and nullif(btrim(p_admin_note), '') is null then
    raise exception using errcode = '22023', message = 'at least one actual detail is required';
  end if;
  if p_product_amount_cny is not null and p_product_amount_cny < 0
    or p_local_delivery_cny is not null and p_local_delivery_cny < 0
    or p_weight_kg is not null and p_weight_kg <= 0 then
    raise exception using errcode = '22023', message = 'actual monetary values must be non-negative and weight must be positive';
  end if;

  select * into v_order from public.order_items where id = p_order_item_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'order item not found';
  end if;

  select * into v_previous from public.order_actual_details
  where order_actual_details.order_item_id = p_order_item_id
  order by created_at desc, id desc limit 1;

  insert into public.order_actual_details (
    order_item_id, product_amount_cny, local_delivery_cny, weight_kg, admin_note, reason, recorded_by
  ) values (
    p_order_item_id,
    coalesce(p_product_amount_cny, v_previous.product_amount_cny),
    coalesce(p_local_delivery_cny, v_previous.local_delivery_cny),
    coalesce(p_weight_kg, v_previous.weight_kg),
    coalesce(nullif(btrim(p_admin_note), ''), v_previous.admin_note),
    btrim(p_reason), v_actor
  ) returning * into v_record;

  perform private.write_audit_log_internal(
    'order_item_actual_details',
    v_record.id,
    'order_actual_details_recorded',
    case when v_previous.id is null then null else to_jsonb(v_previous) end,
    to_jsonb(v_record),
    v_record.reason
  );

  return query select v_record.id, v_record.order_item_id, v_record.product_amount_cny,
    v_record.local_delivery_cny, v_record.weight_kg, v_record.admin_note, v_record.created_at;
end;
$$;

revoke all on function public.record_order_actual_details(uuid, numeric, numeric, numeric, text, text)
  from public, anon;
grant execute on function public.record_order_actual_details(uuid, numeric, numeric, numeric, text, text)
  to authenticated, service_role;

-- This private view is the line-level source for the Phase 4 client statement
-- API. It is not exposed to authenticated clients directly.
create or replace view private.client_product_statement_line_facts
with (security_invoker = true)
as
select
  oi.id as order_item_id,
  oi.client_id,
  oi.product_link_id,
  oi.quantity,
  oi.category,
  oi.status,
  oi.created_at,
  oi.estimate_id,
  pl.provider_item_id as product_code,
  pl.title as product_title,
  pl.images as product_images,
  oi.admin_notes,
  od.admin_note as actual_admin_note,
  oi.estimated_total_bdt,
  oi.product_cost_cny as estimated_product_amount_cny,
  oi.domestic_delivery_cny as estimated_local_delivery_cny,
  oi.estimated_weight_kg,
  oi.china_to_guangzhou_cny as estimated_guangzhou_cny,
  oi.service_charge_cny as estimated_service_charge_cny,
  oi.international_shipping_bdt as estimated_international_shipping_bdt,
  coalesce(od.product_amount_cny, po.actual_product_subtotal_cny, po.paid_amount_cny) as actual_product_amount_cny,
  coalesce(od.local_delivery_cny, po.actual_domestic_delivery_cny) as actual_local_delivery_cny,
  coalesce(od.weight_kg, oi.actual_weight_kg, received.weight_kg) as actual_weight_kg,
  wallet_rate.cny_to_bdt_rate as actual_cny_to_bdt_rate,
  coalesce(
    nullif(oi.cost_snapshot #>> '{inputs,internationalShippingRateBdtPerKg}', '')::numeric,
    est.category_shipping_bdt / nullif(est.estimated_total_weight_kg, 0)
  ) as international_shipping_rate_bdt_per_kg,
  case when oi.estimate_id is not null then true else false end as has_persisted_estimate,
  coalesce(
    nullif(oi.cost_snapshot #>> '{inputs,exchangeRateCnyToBdt}', '')::numeric,
    est.exchange_rate_cny_to_bdt
  ) as estimated_cny_to_bdt_rate
from public.order_items oi
join public.product_links pl on pl.id = oi.product_link_id
left join public.estimates est on est.id = oi.estimate_id
left join lateral (
  select d.* from public.order_actual_details d
  where d.order_item_id = oi.id
  order by d.created_at desc, d.id desc limit 1
) od on true
left join lateral (
  select p.* from public.provider_orders p
  where p.order_item_id = oi.id
  order by p.synced_at desc nulls last, p.created_at desc, p.id desc limit 1
) po on true
left join lateral (
  select sum(pi.weight_kg)::numeric(14,3) as weight_kg
  from public.parcel_items pi
  where pi.order_item_id = oi.id and pi.weight_kg is not null
) received on true
left join lateral (
  select wt.cny_to_bdt_rate from public.wallet_transactions wt
  where wt.order_item_id = oi.id
    and wt.transaction_type = 'order_debit'
    and wt.status = 'posted'
  order by wt.created_at desc, wt.id desc limit 1
) wallet_rate on true;

revoke all on table private.client_product_statement_line_facts from public, anon, authenticated;

commit;
