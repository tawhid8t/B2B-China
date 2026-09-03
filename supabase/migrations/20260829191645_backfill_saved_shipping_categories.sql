-- Backfill categories from the category selected during estimate/order
-- calculation. This is idempotent and only corrects placeholder defaults.
begin;

with category_source as (
  select oi.product_link_id,
    max(nullif(oi.cost_snapshot->'inputs'->>'internationalShippingCategory', '')) as category
  from public.order_items oi
  where oi.category = 'default'
  group by oi.product_link_id
), updated_orders as (
  update public.order_items oi
  set category = nullif(oi.cost_snapshot->'inputs'->>'internationalShippingCategory', '')
  where oi.category = 'default'
    and nullif(oi.cost_snapshot->'inputs'->>'internationalShippingCategory', '') is not null
  returning 1
)
update public.product_links pl
set category = source.category
from category_source source
where pl.id = source.product_link_id
  and pl.category = 'default';

commit;
