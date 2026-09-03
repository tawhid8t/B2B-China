-- Product Statement detail is an owned, aggregate read model. It intentionally
-- returns normalized order facts only; provider payloads and credentials remain private.
begin;

create or replace function public.get_client_product_statement_detail(
  p_product_link_id uuid
)
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

  select c.id into v_client_id
  from public.clients c
  where c.profile_id = (select auth.uid());

  if v_client_id is null then
    raise exception using errcode = '42501', message = 'client profile required';
  end if;

  if not exists (
    select 1
    from public.product_orders po
    where po.client_id = v_client_id
      and po.product_link_id = p_product_link_id
  ) then
    return null;
  end if;

  return (
    with line_values as (
      select
        f.order_item_id,
        f.product_link_id,
        f.quantity,
        f.status,
        f.created_at as line_created_at,
        f.product_code,
        f.product_title,
        f.product_images,
        f.category,
        f.actual_admin_note,
        f.admin_notes,
        f.international_shipping_rate_bdt_per_kg,
        oi.product_order_id,
        po.order_number,
        po.created_at as submitted_at,
        coalesce(ps.label, oi.sku_id::text) as sku_label,
        coalesce(ps.attributes, '{}'::jsonb) as attributes,
        case when f.actual_product_amount_cny is not null then f.actual_product_amount_cny
          when f.has_persisted_estimate then f.estimated_product_amount_cny end as product_amount_cny,
        case when f.actual_local_delivery_cny is not null then f.actual_local_delivery_cny
          when f.has_persisted_estimate then f.estimated_local_delivery_cny end as local_delivery_cny,
        case when f.actual_weight_kg is not null then f.actual_weight_kg
          when f.has_persisted_estimate then f.estimated_weight_kg end as weight_kg,
        coalesce(f.actual_cny_to_bdt_rate, f.estimated_cny_to_bdt_rate) as cny_to_bdt_rate,
        case when f.actual_product_amount_cny is not null then 'actual'
          when f.has_persisted_estimate and f.estimated_product_amount_cny is not null then 'estimated' end as product_mode,
        case when f.actual_local_delivery_cny is not null then 'actual'
          when f.has_persisted_estimate and f.estimated_local_delivery_cny is not null then 'estimated' end as local_mode,
        case when f.actual_weight_kg is not null then 'actual'
          when f.has_persisted_estimate and f.estimated_weight_kg is not null then 'estimated' end as weight_mode,
        case f.status
          when 'exception' then 0 when 'cancelled' then 1
          when 'pending_admin_review' then 10 when 'confirmed' then 20
          when 'queued_for_purchase' then 30 when 'purchased' then 40
          when 'seller_shipped' then 50 when 'received_china' then 60
          when 'qc_checked' then 70 when 'packed' then 80
          when 'sent_guangzhou' then 90 when 'arrived_guangzhou' then 100
          when 'sent_bangladesh' then 110 when 'arrived_bangladesh' then 120
          when 'ready_for_pickup' then 130 when 'completed' then 140 else 999
        end as status_rank
      from private.client_product_statement_line_facts f
      join public.order_items oi on oi.id = f.order_item_id
      join public.product_orders po on po.id = oi.product_order_id
      left join public.product_skus ps on ps.id = oi.product_sku_id
      where f.client_id = v_client_id
        and f.product_link_id = p_product_link_id
    ),
    calculated_lines as (
      select
        l.*,
        case when l.weight_kg is not null then round(l.weight_kg * 4, 2) end as guangzhou_cost_cny,
        case when l.product_amount_cny is not null then round(l.product_amount_cny * 0.06, 2) end as service_charge_cny,
        case when l.weight_kg is not null and l.international_shipping_rate_bdt_per_kg is not null
          then round(l.weight_kg * l.international_shipping_rate_bdt_per_kg, 2) end as bangladesh_shipping_bdt
      from line_values l
    ),
    totals as (
      select
        c.*,
        case when c.product_amount_cny is not null and c.local_delivery_cny is not null
          and c.guangzhou_cost_cny is not null and c.service_charge_cny is not null
          and c.bangladesh_shipping_bdt is not null and c.cny_to_bdt_rate is not null
          then round((c.product_amount_cny + c.local_delivery_cny + c.guangzhou_cost_cny + c.service_charge_cny) * c.cny_to_bdt_rate + c.bangladesh_shipping_bdt, 2)
        end as total_bdt,
        case
          when c.product_mode = 'actual' and c.local_mode = 'actual' and c.weight_mode = 'actual' then 'actual'
          when c.product_mode = 'actual' or c.local_mode = 'actual' or c.weight_mode = 'actual' then 'partial'
          when c.product_mode = 'estimated' or c.local_mode = 'estimated' or c.weight_mode = 'estimated' then 'estimated'
          else 'unavailable'
        end as cost_state
      from calculated_lines c
    ),
    submission_rows as (
      select
        t.product_order_id,
        max(t.order_number) as order_number,
        max(t.submitted_at) as submitted_at,
        (array_agg(t.status order by t.status_rank desc, t.line_created_at desc))[1] as status,
        sum(t.quantity)::integer as total_quantity,
        sum(t.product_amount_cny) as product_amount_cny,
        sum(t.local_delivery_cny) as local_delivery_cny,
        sum(t.weight_kg) as total_weight_kg,
        sum(t.guangzhou_cost_cny) as guangzhou_cost_cny,
        sum(t.service_charge_cny) as service_charge_cny,
        sum(t.bangladesh_shipping_bdt) as bangladesh_shipping_bdt,
        sum(t.total_bdt) as total_bdt,
        case
          when bool_or(t.cost_state = 'partial') then 'partial'
          when bool_and(t.cost_state = 'actual') then 'actual'
          when bool_or(t.cost_state = 'estimated') then 'estimated'
          else 'unavailable'
        end as cost_state,
        jsonb_agg(jsonb_build_object(
          'orderItemId', t.order_item_id,
          'skuLabel', t.sku_label,
          'attributes', t.attributes,
          'quantity', t.quantity,
          'status', t.status,
          'costState', t.cost_state,
          'supplierAmountCny', t.product_amount_cny,
          'localDeliveryCny', t.local_delivery_cny,
          'weightKg', t.weight_kg,
          'guangzhouCostCny', t.guangzhou_cost_cny,
          'serviceChargeCny', t.service_charge_cny,
          'bangladeshShippingBdt', t.bangladesh_shipping_bdt,
          'totalBdt', t.total_bdt,
          'exchangeRate', t.cny_to_bdt_rate,
          'note', coalesce(nullif(t.actual_admin_note, ''), nullif(t.admin_notes, ''))
        ) order by t.line_created_at, t.order_item_id) as sku_lines
      from totals t
      group by t.product_order_id
    ),
    aggregate_values as (
      select
        max(t.product_code) as product_code,
        max(t.product_title) as product_title,
        max(t.product_images) as product_images,
        case when count(distinct t.category) = 1 then max(t.category) else 'mixed' end as category,
        sum(t.quantity)::integer as total_quantity,
        sum(t.product_amount_cny) as product_amount_cny,
        sum(t.local_delivery_cny) as local_delivery_cny,
        sum(t.weight_kg) as total_weight_kg,
        sum(t.guangzhou_cost_cny) as guangzhou_cost_cny,
        sum(t.service_charge_cny) as service_charge_cny,
        sum(t.bangladesh_shipping_bdt) as bangladesh_shipping_bdt,
        sum(t.total_bdt) as total_bdt,
        case
          when bool_or(t.cost_state = 'partial') then 'partial'
          when bool_and(t.cost_state = 'actual') then 'actual'
          when bool_or(t.cost_state = 'estimated') then 'estimated'
          else 'unavailable'
        end as cost_state,
        (array_agg(t.status order by t.status_rank desc, t.line_created_at desc))[1] as status,
        count(distinct t.status) > 1 as mixed_progress,
        coalesce(nullif(max(t.actual_admin_note), ''), nullif(max(t.admin_notes), '')) as note
      from totals t
    )
    select jsonb_build_object(
      'product', jsonb_build_object(
        'productLinkId', p_product_link_id,
        'productCode', a.product_code,
        'title', a.product_title,
        'images', coalesce(to_jsonb(a.product_images), '[]'::jsonb),
        'category', a.category
      ),
      'aggregate', jsonb_build_object(
        'totalQuantity', a.total_quantity,
        'productAmountCny', a.product_amount_cny,
        'localDeliveryCny', a.local_delivery_cny,
        'totalWeightKg', a.total_weight_kg,
        'guangzhouCostCny', a.guangzhou_cost_cny,
        'serviceChargeCny', a.service_charge_cny,
        'bangladeshShippingBdt', a.bangladesh_shipping_bdt,
        'totalBdt', a.total_bdt,
        'costState', a.cost_state,
        'status', a.status,
        'mixedProgress', a.mixed_progress,
        'note', a.note
      ),
      'submissions', coalesce((select jsonb_agg(jsonb_build_object(
        'productOrderId', s.product_order_id,
        'orderNumber', s.order_number,
        'submittedAt', s.submitted_at,
        'status', s.status,
        'totalQuantity', s.total_quantity,
        'productAmountCny', s.product_amount_cny,
        'localDeliveryCny', s.local_delivery_cny,
        'totalWeightKg', s.total_weight_kg,
        'guangzhouCostCny', s.guangzhou_cost_cny,
        'serviceChargeCny', s.service_charge_cny,
        'bangladeshShippingBdt', s.bangladesh_shipping_bdt,
        'totalBdt', s.total_bdt,
        'costState', s.cost_state,
        'skuLines', s.sku_lines
      ) order by s.submitted_at desc, s.product_order_id) from submission_rows s), '[]'::jsonb)
    )
    from aggregate_values a
  );
end;
$$;

revoke all on function public.get_client_product_statement_detail(uuid) from public, anon;
grant execute on function public.get_client_product_statement_detail(uuid) to authenticated;

commit;
