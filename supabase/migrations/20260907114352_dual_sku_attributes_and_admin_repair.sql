begin;

-- Keep the client-facing translation separate from the exact supplier labels.
alter table public.product_skus
  add column if not exists provider_attributes jsonb not null default '{}'::jsonb;

alter table public.order_items
  add column if not exists display_attributes_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists provider_attributes_snapshot jsonb not null default '{}'::jsonb;

comment on column public.product_skus.attributes is
  'Translated, client-facing SKU attributes.';
comment on column public.product_skus.provider_attributes is
  'Original supplier SKU attributes used only by controlled purchasing operations.';
comment on column public.order_items.display_attributes_snapshot is
  'Immutable client-facing SKU attributes at order submission.';
comment on column public.order_items.provider_attributes_snapshot is
  'Supplier attributes at order submission, or an audited pre-purchase admin correction.';

create or replace function private.capture_order_item_attribute_snapshots()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sku public.product_skus%rowtype;
begin
  if new.product_sku_id is null then return new; end if;
  select * into v_sku from public.product_skus where id = new.product_sku_id;
  if not found then return new; end if;
  if new.display_attributes_snapshot = '{}'::jsonb then
    new.display_attributes_snapshot := v_sku.attributes;
  end if;
  if new.provider_attributes_snapshot = '{}'::jsonb then
    new.provider_attributes_snapshot := coalesce(nullif(v_sku.provider_attributes, '{}'::jsonb), v_sku.attributes);
  end if;
  return new;
end;
$$;

revoke all on function private.capture_order_item_attribute_snapshots() from public, anon;
drop trigger if exists order_items_capture_attribute_snapshots on public.order_items;
create trigger order_items_capture_attribute_snapshots
before insert on public.order_items
for each row execute function private.capture_order_item_attribute_snapshots();

-- Existing orders retain their original client display value. Supplier values
-- are copied only when a previous snapshot is absent; later corrections are
-- intentionally never overwritten by product refreshes.
update public.order_items oi
set display_attributes_snapshot = ps.attributes,
    provider_attributes_snapshot = coalesce(nullif(ps.provider_attributes, '{}'::jsonb), ps.attributes)
from public.product_skus ps
where ps.id = oi.product_sku_id
  and oi.display_attributes_snapshot = '{}'::jsonb
  and oi.provider_attributes_snapshot = '{}'::jsonb;

create or replace function public.persist_product_snapshot(
  p_actor_id uuid,
  p_product jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_product public.product_links%rowtype;
  v_skus jsonb;
begin
  if p_actor_id is null then raise exception 'An actor is required to persist a product snapshot.'; end if;
  if jsonb_typeof(p_product) <> 'object' or nullif(btrim(p_product->>'provider'), '') is null
    or nullif(btrim(p_product->>'providerItemId'), '') is null or nullif(btrim(p_product->>'originalUrl'), '') is null
    or nullif(btrim(p_product->>'title'), '') is null then raise exception 'The product snapshot is incomplete.'; end if;
  if jsonb_typeof(coalesce(p_product->'images', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_product->'images', '[]'::jsonb)) = 0 then raise exception 'The product snapshot requires at least one image.'; end if;
  if jsonb_typeof(coalesce(p_product->'skus', '[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_product->'skus', '[]'::jsonb)) = 0 or jsonb_array_length(coalesce(p_product->'skus', '[]'::jsonb)) > 500 then raise exception 'The product snapshot must contain between 1 and 500 SKUs.'; end if;

  insert into public.product_links (original_url, provider, provider_item_id, title, title_cn, images, sku_matrix, category, domestic_delivery_cny, price_min_cny, price_max_cny, raw_payload, source_status, created_by)
  values (p_product->>'originalUrl', p_product->>'provider', p_product->>'providerItemId', p_product->>'title', nullif(p_product->>'titleCn', ''), array(select jsonb_array_elements_text(p_product->'images')), p_product->'skus', coalesce(nullif(p_product->>'category', ''), 'default'), coalesce((p_product->>'domesticDeliveryCny')::numeric, 0), nullif(p_product->>'priceMinCny', '')::numeric, nullif(p_product->>'priceMaxCny', '')::numeric, coalesce(p_product->'raw', '{}'::jsonb), 'active', p_actor_id)
  on conflict (provider, provider_item_id) do update set original_url = excluded.original_url, title = excluded.title, title_cn = excluded.title_cn, images = excluded.images, sku_matrix = excluded.sku_matrix, category = excluded.category, domestic_delivery_cny = excluded.domestic_delivery_cny, price_min_cny = excluded.price_min_cny, price_max_cny = excluded.price_max_cny, raw_payload = excluded.raw_payload, source_status = excluded.source_status, created_by = excluded.created_by, updated_at = now()
  returning * into v_product;

  insert into public.product_skus (product_link_id, provider_sku_id, label, attributes, provider_attributes, price_cny, available_quantity, image_url)
  select v_product.id, coalesce(nullif(sku->>'providerSkuId', ''), nullif(sku->>'id', '')), sku->>'label',
    coalesce(sku->'attributes', '{}'::jsonb), coalesce(nullif(sku->'providerAttributes', '{}'::jsonb), sku->'attributes', '{}'::jsonb),
    (sku->>'priceCny')::numeric, nullif(sku->>'availableQuantity', '')::integer, nullif(sku->>'imageUrl', '')
  from jsonb_array_elements(p_product->'skus') as source(sku)
  on conflict (product_link_id, provider_sku_id) where provider_sku_id is not null do update
  set label = excluded.label, attributes = excluded.attributes, provider_attributes = excluded.provider_attributes, price_cny = excluded.price_cny, available_quantity = excluded.available_quantity, image_url = excluded.image_url, updated_at = now();

  select coalesce(jsonb_agg(jsonb_build_object('skuId', persisted.id::text, 'providerSkuId', persisted.provider_sku_id, 'label', persisted.label, 'attributes', persisted.attributes, 'providerAttributes', persisted.provider_attributes, 'priceCny', persisted.price_cny, 'availableQuantity', persisted.available_quantity, 'imageUrl', persisted.image_url) order by source.position), '[]'::jsonb)
  into v_skus
  from jsonb_array_elements(p_product->'skus') with ordinality as source(sku, position)
  join public.product_skus persisted on persisted.product_link_id = v_product.id and persisted.provider_sku_id = coalesce(nullif(source.sku->>'providerSkuId', ''), nullif(source.sku->>'id', ''));

  insert into public.audit_logs (actor_id, entity_type, entity_id, action, after_data)
  values (p_actor_id, 'product_link', v_product.id, 'product_snapshot_resolved', jsonb_build_object('provider', v_product.provider, 'providerItemId', v_product.provider_item_id, 'rawPayload', coalesce(p_product->'raw', '{}'::jsonb)));

  return jsonb_build_object('productId', v_product.id::text, 'provider', v_product.provider, 'providerItemId', v_product.provider_item_id, 'originalUrl', v_product.original_url, 'title', v_product.title, 'titleCn', v_product.title_cn, 'images', to_jsonb(v_product.images), 'category', v_product.category, 'domesticDeliveryCny', v_product.domestic_delivery_cny, 'priceMinCny', v_product.price_min_cny, 'priceMaxCny', v_product.price_max_cny, 'skus', v_skus);
end;
$$;

revoke execute on function public.persist_product_snapshot(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.persist_product_snapshot(uuid, jsonb) to service_role;

drop function public.get_extension_purchase_queue_v2_for_credential(uuid);
drop function public.get_extension_purchase_queue_v2();
create function public.get_extension_purchase_queue_v2()
returns table (
  purchase_task_id uuid, product_order_id uuid, purchase_batch_id uuid, order_number text, provider text, product_url text, provider_item_id text, product_title text, product_image text,
  task_state text, can_prepare boolean, block_reason text, order_item_id uuid, provider_sku_id text, sku_label text, attributes jsonb, display_attributes jsonb, quantity integer, expected_unit_price_cny numeric(14,2), expected_domestic_delivery_cny numeric(14,2)
)
language plpgsql security invoker set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.current_user_role() not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'admin role required'; end if;
  return query
  select pt.id, po.id, pt.purchase_batch_id, po.order_number, pl.provider, pl.original_url, pl.provider_item_id, pl.title, coalesce(ps.image_url, pl.images[1]), pt.state,
    pt.state = 'queued' and not exists (select 1 from public.order_items incomplete where incomplete.product_order_id = po.id and incomplete.status <> 'queued_for_purchase'),
    case when pt.state <> 'queued' then coalesce(pt.last_error, 'This product requires admin review before cart preparation.') when exists (select 1 from public.order_items incomplete where incomplete.product_order_id = po.id and incomplete.status <> 'queued_for_purchase') then 'Every SKU must be queued for purchase before this product can be prepared.' else null end,
    oi.id, ps.provider_sku_id, coalesce(ps.label, oi.sku_id),
    coalesce(nullif(oi.provider_attributes_snapshot, '{}'::jsonb), nullif(ps.provider_attributes, '{}'::jsonb), ps.attributes, '{}'::jsonb),
    coalesce(nullif(oi.display_attributes_snapshot, '{}'::jsonb), ps.attributes, '{}'::jsonb), oi.quantity, oi.cny_price::numeric(14,2), oi.domestic_delivery_cny::numeric(14,2)
  from public.purchase_tasks pt join public.product_orders po on po.id = pt.product_order_id join public.product_links pl on pl.id = po.product_link_id join public.order_items oi on oi.product_order_id = po.id left join public.product_skus ps on ps.id = oi.product_sku_id
  where pt.state in ('queued', 'needs_review') order by pt.created_at asc, oi.created_at asc, oi.id asc;
end;
$$;
revoke all on function public.get_extension_purchase_queue_v2() from public, anon;
grant execute on function public.get_extension_purchase_queue_v2() to authenticated, service_role;

create function public.get_extension_purchase_queue_v2_for_credential(p_profile_id uuid)
returns table (
  purchase_task_id uuid, product_order_id uuid, purchase_batch_id uuid, order_number text, provider text, product_url text, provider_item_id text, product_title text, product_image text,
  task_state text, can_prepare boolean, block_reason text, order_item_id uuid, provider_sku_id text, sku_label text, attributes jsonb, display_attributes jsonb, quantity integer, expected_unit_price_cny numeric(14,2), expected_domestic_delivery_cny numeric(14,2)
)
language plpgsql security definer set search_path = ''
as $$ begin perform set_config('request.jwt.claim.sub', p_profile_id::text, true); return query select * from public.get_extension_purchase_queue_v2(); end; $$;
revoke all on function public.get_extension_purchase_queue_v2_for_credential(uuid) from public, anon, authenticated;
grant execute on function public.get_extension_purchase_queue_v2_for_credential(uuid) to service_role;

create or replace function public.correct_purchase_task_sku_attributes(
  p_purchase_task_id uuid, p_corrections jsonb, p_reason text
)
returns table (purchase_task_id uuid, purchase_task_state text, updated_at timestamptz)
language plpgsql security invoker set search_path = ''
as $$
declare v_task public.purchase_tasks%rowtype; v_before jsonb; v_expected uuid[]; v_received uuid[]; v_bad boolean;
begin
  if (select auth.uid()) is null or public.current_user_role() not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'admin role required'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception using errcode = '22023', message = 'a correction reason is required'; end if;
  if jsonb_typeof(p_corrections) <> 'array' or jsonb_array_length(p_corrections) = 0 then raise exception using errcode = '22023', message = 'every SKU correction is required'; end if;
  select * into v_task from public.purchase_tasks where id = p_purchase_task_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'purchase task not found'; end if;
  if v_task.state not in ('queued', 'needs_review') then raise exception using errcode = '23514', message = 'only unpurchased tasks may have supplier attributes corrected'; end if;
  select array_agg(id order by id) into v_expected from public.order_items where product_order_id = v_task.product_order_id;
  select array_agg(distinct (entry->>'orderItemId')::uuid order by (entry->>'orderItemId')::uuid) into v_received from jsonb_array_elements(p_corrections) entry;
  if v_expected is null or v_expected is distinct from v_received then raise exception using errcode = '23514', message = 'the correction must include every SKU line exactly once'; end if;
  select exists (select 1 from jsonb_array_elements(p_corrections) entry where jsonb_typeof(entry->'providerAttributes') <> 'object' or entry->'providerAttributes' = '{}'::jsonb or exists (select 1 from jsonb_each_text(entry->'providerAttributes') pair where nullif(btrim(pair.key), '') is null or nullif(btrim(pair.value), '') is null or lower(btrim(pair.key)) = lower(btrim(pair.value)))) into v_bad;
  if v_bad then raise exception using errcode = '22023', message = 'each supplier attribute must have an exact non-placeholder label and value'; end if;
  v_before := to_jsonb(v_task);
  update public.order_items oi set provider_attributes_snapshot = entry->'providerAttributes'
  from jsonb_array_elements(p_corrections) entry where oi.id = (entry->>'orderItemId')::uuid and oi.product_order_id = v_task.product_order_id;
  update public.purchase_tasks set state = 'queued', last_error = null where id = v_task.id returning * into v_task;
  perform private.write_audit_log_internal('purchase_task', v_task.id, 'purchase_task_supplier_attributes_corrected', v_before, jsonb_build_object('task', to_jsonb(v_task), 'corrections', p_corrections), btrim(p_reason));
  return query select v_task.id, v_task.state, v_task.updated_at;
end;
$$;
revoke all on function public.correct_purchase_task_sku_attributes(uuid, jsonb, text) from public, anon;
grant execute on function public.correct_purchase_task_sku_attributes(uuid, jsonb, text) to authenticated, service_role;

commit;
