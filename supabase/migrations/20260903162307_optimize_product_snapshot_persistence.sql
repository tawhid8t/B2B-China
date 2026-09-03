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
  if p_actor_id is null then
    raise exception 'An actor is required to persist a product snapshot.';
  end if;

  if jsonb_typeof(p_product) <> 'object'
     or nullif(btrim(p_product->>'provider'), '') is null
     or nullif(btrim(p_product->>'providerItemId'), '') is null
     or nullif(btrim(p_product->>'originalUrl'), '') is null
     or nullif(btrim(p_product->>'title'), '') is null then
    raise exception 'The product snapshot is incomplete.';
  end if;

  if jsonb_typeof(coalesce(p_product->'images', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_product->'images', '[]'::jsonb)) = 0 then
    raise exception 'The product snapshot requires at least one image.';
  end if;

  if jsonb_typeof(coalesce(p_product->'skus', '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_product->'skus', '[]'::jsonb)) = 0
     or jsonb_array_length(coalesce(p_product->'skus', '[]'::jsonb)) > 500 then
    raise exception 'The product snapshot must contain between 1 and 500 SKUs.';
  end if;

  insert into public.product_links (
    original_url,
    provider,
    provider_item_id,
    title,
    title_cn,
    images,
    sku_matrix,
    category,
    domestic_delivery_cny,
    price_min_cny,
    price_max_cny,
    raw_payload,
    source_status,
    created_by
  )
  values (
    p_product->>'originalUrl',
    p_product->>'provider',
    p_product->>'providerItemId',
    p_product->>'title',
    nullif(p_product->>'titleCn', ''),
    array(select jsonb_array_elements_text(p_product->'images')),
    p_product->'skus',
    coalesce(nullif(p_product->>'category', ''), 'default'),
    coalesce((p_product->>'domesticDeliveryCny')::numeric, 0),
    nullif(p_product->>'priceMinCny', '')::numeric,
    nullif(p_product->>'priceMaxCny', '')::numeric,
    coalesce(p_product->'raw', '{}'::jsonb),
    'active',
    p_actor_id
  )
  on conflict (provider, provider_item_id) do update
  set original_url = excluded.original_url,
      title = excluded.title,
      title_cn = excluded.title_cn,
      images = excluded.images,
      sku_matrix = excluded.sku_matrix,
      category = excluded.category,
      domestic_delivery_cny = excluded.domestic_delivery_cny,
      price_min_cny = excluded.price_min_cny,
      price_max_cny = excluded.price_max_cny,
      raw_payload = excluded.raw_payload,
      source_status = excluded.source_status,
      created_by = excluded.created_by,
      updated_at = now()
  returning * into v_product;

  insert into public.product_skus (
    product_link_id,
    provider_sku_id,
    label,
    attributes,
    price_cny,
    available_quantity,
    image_url
  )
  select
    v_product.id,
    coalesce(nullif(sku->>'providerSkuId', ''), nullif(sku->>'id', '')),
    sku->>'label',
    coalesce(sku->'attributes', '{}'::jsonb),
    (sku->>'priceCny')::numeric,
    nullif(sku->>'availableQuantity', '')::integer,
    nullif(sku->>'imageUrl', '')
  from jsonb_array_elements(p_product->'skus') as source(sku)
  on conflict (product_link_id, provider_sku_id)
    where provider_sku_id is not null
  do update
  set label = excluded.label,
      attributes = excluded.attributes,
      price_cny = excluded.price_cny,
      available_quantity = excluded.available_quantity,
      image_url = excluded.image_url,
      updated_at = now();

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'skuId', persisted.id::text,
        'providerSkuId', persisted.provider_sku_id,
        'label', persisted.label,
        'attributes', persisted.attributes,
        'priceCny', persisted.price_cny,
        'availableQuantity', persisted.available_quantity,
        'imageUrl', persisted.image_url
      ) order by source.position
    ),
    '[]'::jsonb
  )
  into v_skus
  from jsonb_array_elements(p_product->'skus') with ordinality as source(sku, position)
  join public.product_skus persisted
    on persisted.product_link_id = v_product.id
   and persisted.provider_sku_id = coalesce(nullif(source.sku->>'providerSkuId', ''), nullif(source.sku->>'id', ''));

  insert into public.audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    after_data
  )
  values (
    p_actor_id,
    'product_link',
    v_product.id,
    'product_snapshot_resolved',
    jsonb_build_object(
      'provider', v_product.provider,
      'providerItemId', v_product.provider_item_id,
      'rawPayload', coalesce(p_product->'raw', '{}'::jsonb)
    )
  );

  return jsonb_build_object(
    'productId', v_product.id::text,
    'provider', v_product.provider,
    'providerItemId', v_product.provider_item_id,
    'originalUrl', v_product.original_url,
    'title', v_product.title,
    'titleCn', v_product.title_cn,
    'images', to_jsonb(v_product.images),
    'category', v_product.category,
    'domesticDeliveryCny', v_product.domestic_delivery_cny,
    'priceMinCny', v_product.price_min_cny,
    'priceMaxCny', v_product.price_max_cny,
    'skus', v_skus
  );
end;
$$;

revoke execute on function public.persist_product_snapshot(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.persist_product_snapshot(uuid, jsonb) to service_role;

comment on function public.persist_product_snapshot(uuid, jsonb) is
  'Atomically persists one normalized provider product, up to 500 SKUs, and its audit record for server-side resolution.';
