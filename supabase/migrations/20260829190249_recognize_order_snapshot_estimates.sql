-- Direct confirmations persist their estimate in order_items.cost_snapshot and
-- estimated_total_bdt rather than creating an estimates row. Keep those
-- values eligible for estimated statement cells.
begin;

create or replace view private.client_product_statement_line_facts
with (security_invoker = true)
as
select
  oi.id as order_item_id, oi.client_id, oi.product_link_id, oi.quantity, oi.category, oi.status, oi.created_at, oi.estimate_id,
  pl.provider_item_id as product_code, pl.title as product_title, pl.images as product_images,
  oi.admin_notes, od.admin_note as actual_admin_note, oi.estimated_total_bdt,
  oi.product_cost_cny as estimated_product_amount_cny, oi.domestic_delivery_cny as estimated_local_delivery_cny,
  oi.estimated_weight_kg, oi.china_to_guangzhou_cny as estimated_guangzhou_cny,
  oi.service_charge_cny as estimated_service_charge_cny, oi.international_shipping_bdt as estimated_international_shipping_bdt,
  coalesce(od.product_amount_cny, po.actual_product_subtotal_cny, po.paid_amount_cny) as actual_product_amount_cny,
  coalesce(od.local_delivery_cny, po.actual_domestic_delivery_cny) as actual_local_delivery_cny,
  coalesce(od.weight_kg, oi.actual_weight_kg, received.weight_kg) as actual_weight_kg,
  wallet_rate.cny_to_bdt_rate as actual_cny_to_bdt_rate,
  coalesce(nullif(oi.cost_snapshot #>> '{inputs,internationalShippingRateBdtPerKg}', '')::numeric, est.category_shipping_bdt / nullif(est.estimated_total_weight_kg, 0)) as international_shipping_rate_bdt_per_kg,
  case when oi.estimate_id is not null or oi.estimated_total_bdt is not null or oi.cost_snapshot is not null then true else false end as has_persisted_estimate,
  coalesce(nullif(oi.cost_snapshot #>> '{inputs,exchangeRateCnyToBdt}', '')::numeric, est.exchange_rate_cny_to_bdt) as estimated_cny_to_bdt_rate
from public.order_items oi
join public.product_links pl on pl.id = oi.product_link_id
left join public.estimates est on est.id = oi.estimate_id
left join lateral (select d.* from public.order_actual_details d where d.order_item_id = oi.id order by d.created_at desc, d.id desc limit 1) od on true
left join lateral (select p.* from public.provider_orders p where p.order_item_id = oi.id order by p.synced_at desc nulls last, p.created_at desc, p.id desc limit 1) po on true
left join lateral (select sum(pi.weight_kg)::numeric(14,3) as weight_kg from public.parcel_items pi where pi.order_item_id = oi.id and pi.weight_kg is not null) received on true
left join lateral (select wt.cny_to_bdt_rate from public.wallet_transactions wt where wt.order_item_id = oi.id and wt.transaction_type = 'order_debit' and wt.status = 'posted' order by wt.created_at desc, wt.id desc limit 1) wallet_rate on true;

revoke all on table private.client_product_statement_line_facts from public, anon, authenticated;

commit;
