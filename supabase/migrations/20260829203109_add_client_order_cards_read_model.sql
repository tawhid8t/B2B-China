-- Phase 1: additive, client-owned order-card read model for the Orders redesign.
begin;

create or replace function public.get_client_order_cards()
returns jsonb
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

  select c.id into v_client_id from public.clients c where c.profile_id = (select auth.uid());
  if v_client_id is null then
    return jsonb_build_object('orders', '[]'::jsonb);
  end if;

  return (
    with source_lines as (
      select
        oi.id,
        oi.product_link_id,
        oi.client_id,
        oi.quantity,
        oi.cny_price,
        oi.domestic_delivery_cny,
        oi.international_shipping_bdt,
        oi.estimated_total_bdt,
        oi.actual_total_bdt,
        oi.status,
        oi.created_at,
        oi.product_original_url,
        oi.client_notes,
        pl.provider_item_id as product_id,
        left(pl.title, 180) as short_description,
        pl.images as product_images,
        ps.label as sku_description,
        ps.attributes as sku_attributes,
        ps.image_url as sku_image_url,
        ps.price_cny as sku_price_cny,
        po.provider,
        po.provider_order_id,
        po.paid_amount_cny,
        case oi.status
          when 'exception' then 0 when 'cancelled' then 1
          when 'pending_admin_review' then 10 when 'confirmed' then 20
          when 'queued_for_purchase' then 30 when 'purchased' then 40
          when 'seller_shipped' then 50 when 'received_china' then 60
          when 'qc_checked' then 70 when 'packed' then 80
          when 'sent_guangzhou' then 90 when 'arrived_guangzhou' then 100
          when 'sent_bangladesh' then 110 when 'arrived_bangladesh' then 120
          when 'ready_for_pickup' then 130 when 'completed' then 140 else 999
        end as status_rank
      from public.order_items oi
      join public.product_links pl on pl.id = oi.product_link_id
      left join public.product_skus ps on ps.id = oi.product_sku_id
      left join lateral (
        select p.provider, p.provider_order_id, p.paid_amount_cny
        from public.provider_orders p
        where p.order_item_id = oi.id
        order by p.synced_at desc nulls last, p.created_at desc, p.id desc
        limit 1
      ) po on true
      where oi.client_id = v_client_id
    ),
    keyed as (
      select s.*, coalesce(nullif(s.provider_order_id, ''), s.id::text) as order_key
      from source_lines s
    ),
    grouped as (
      select
        order_key,
        max(provider_order_id) as provider_order_number,
        max(provider) as store_name,
        max(product_id) as product_id,
        max(short_description) as short_description,
        max(product_images) as product_images,
        min(created_at) as ordered_at,
        min(status_rank) as status_rank,
        (array_agg(status order by status_rank, created_at, id))[1] as status,
        bool_and(actual_total_bdt is not null) as all_actual,
        bool_or(actual_total_bdt is not null) as any_actual,
        coalesce(sum(actual_total_bdt), sum(estimated_total_bdt)) as total_amount_bdt,
        jsonb_agg(jsonb_build_object(
          'id', id,
          'imageUrl', coalesce(sku_image_url, product_images[1]),
          'description', coalesce(sku_description, short_description),
          'attributes', coalesce(sku_attributes, '{}'::jsonb),
          'color', coalesce(sku_attributes->>'color', sku_attributes->>'Color'),
          'size', coalesce(sku_attributes->>'size', sku_attributes->>'Size'),
          'unitPriceCny', coalesce(sku_price_cny, cny_price),
          'quantity', quantity,
          'subtotalCny', round(coalesce(sku_price_cny, cny_price) * quantity, 2),
          'shippingFeeCny', domestic_delivery_cny,
          'shippingFeeBdt', international_shipping_bdt,
          'status', status,
          'note', client_notes
        ) order by created_at, id) as skus
      from keyed
      group by order_key
    )
    select jsonb_build_object(
      'orders', coalesce(jsonb_agg(jsonb_build_object(
        'orderId', order_key,
        'productId', product_id,
        'providerOrderNumber', provider_order_number,
        'displayOrderNumber', coalesce(provider_order_number, 'Pending · ' || order_key),
        'orderedAt', ordered_at,
        'product', jsonb_build_object(
          'imageUrl', product_images[1],
          'shortDescription', coalesce(short_description, 'Product details unavailable'),
          'storeName', store_name,
          'storeAccount', null
        ),
        'skus', skus,
        'totalAmountBdt', total_amount_bdt,
        'totalAmountState', case when all_actual then 'actual' when any_actual then 'partial' when total_amount_bdt is not null then 'estimated' else 'unavailable' end,
        'status', status,
        'favorite', jsonb_build_object(
          'eligible', status not in ('cancelled', 'exception') and status_rank >= 20,
          'active', false,
          'favoriteId', null
        )
      ) order by ordered_at desc, order_key), '[]'::jsonb)
    )
    from grouped
  );
end;
$$;

revoke all on function public.get_client_order_cards() from public, anon;
grant execute on function public.get_client_order_cards() to authenticated;

commit;
