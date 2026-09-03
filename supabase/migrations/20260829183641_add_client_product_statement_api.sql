-- Phase 4: expose only client-safe, product-link aggregates. The function
-- derives ownership from auth.uid(); callers cannot supply a client ID.
begin;

create or replace function public.get_client_product_statement(
  p_page integer default 1,
  p_start_date date default null,
  p_end_date date default null,
  p_month date default null,
  p_category text default null,
  p_status public.order_status default null
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
  if p_page < 1 then
    raise exception using errcode = '22023', message = 'page must be at least 1';
  end if;
  if p_start_date is not null and p_end_date is not null and p_start_date > p_end_date then
    raise exception using errcode = '22023', message = 'start date must not be after end date';
  end if;

  select c.id into v_client_id
  from public.clients c
  where c.profile_id = (select auth.uid());

  if v_client_id is null then
    return jsonb_build_object(
      'rows', '[]'::jsonb,
      'total', 0,
      'chart', jsonb_build_object('orderedProducts', 0, 'totalQuantity', 0, 'totalWeightKg', null, 'categories', '[]'::jsonb)
    );
  end if;

  return (
    with filtered_lines as (
      select f.*
      from private.client_product_statement_line_facts f
      where f.client_id = v_client_id
        and (p_start_date is null or f.created_at::date >= p_start_date)
        and (p_end_date is null or f.created_at::date <= p_end_date)
        and (p_month is null or date_trunc('month', f.created_at) = date_trunc('month', p_month::timestamptz))
        and (p_category is null or f.category = p_category)
        and (p_status is null or f.status = p_status)
    ),
    line_values as (
      select
        f.*,
        case when f.actual_product_amount_cny is not null then f.actual_product_amount_cny
          when f.has_persisted_estimate then f.estimated_product_amount_cny end as product_amount_cny,
        case when f.actual_local_delivery_cny is not null then f.actual_local_delivery_cny
          when f.has_persisted_estimate then f.estimated_local_delivery_cny end as local_delivery_cny,
        case when f.actual_weight_kg is not null then f.actual_weight_kg
          when f.has_persisted_estimate then f.estimated_weight_kg end as weight_kg,
        coalesce(f.actual_cny_to_bdt_rate, f.estimated_cny_to_bdt_rate) as cny_to_bdt_rate,
        case when f.actual_product_amount_cny is not null then 'actual'
          when f.has_persisted_estimate and f.estimated_product_amount_cny is not null then 'estimated' end as product_amount_mode,
        case when f.actual_local_delivery_cny is not null then 'actual'
          when f.has_persisted_estimate and f.estimated_local_delivery_cny is not null then 'estimated' end as local_delivery_mode,
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
      from filtered_lines f
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
          when c.actual_product_amount_cny is not null and c.actual_local_delivery_cny is not null and c.actual_weight_kg is not null then 'actual'
          when c.product_amount_mode = 'actual' or c.local_delivery_mode = 'actual' or c.weight_mode = 'actual' then 'partial'
          when c.product_amount_mode = 'estimated' or c.local_delivery_mode = 'estimated' or c.weight_mode = 'estimated' then 'estimated'
          else 'unavailable'
        end as cost_state
      from calculated_lines c
    ),
    grouped as (
      select
        t.product_link_id,
        max(t.product_code) as product_code,
        max(t.product_title) as product_title,
        max(t.product_images) as product_images,
        case when count(distinct t.category) = 1 then max(t.category) else 'mixed' end as category,
        sum(t.quantity)::integer as total_quantity,
        sum(t.product_amount_cny) as product_amount_cny,
        sum(t.local_delivery_cny) as local_delivery_cny,
        sum(t.weight_kg) as total_weight_kg,
        sum(t.guangzhou_cost_cny) as guangzhou_cost_cny,
        sum(t.bangladesh_shipping_bdt) as bangladesh_shipping_bdt,
        sum(t.service_charge_cny) as service_charge_cny,
        sum(t.total_bdt) as total_bdt,
        case when sum(t.total_bdt) is not null and sum(t.quantity) > 0 then round(sum(t.total_bdt) / sum(t.quantity), 2) end as average_unit_cost_bdt,
        (array_agg(t.status order by t.status_rank, t.created_at))[1] as status,
        count(distinct t.status) > 1 as mixed_progress,
        case
          when bool_or(t.cost_state = 'partial') then 'partial'
          when bool_and(t.cost_state = 'actual') then 'actual'
          when bool_or(t.cost_state = 'estimated') then 'estimated'
          else 'unavailable'
        end as cost_state,
        coalesce(nullif(max(t.actual_admin_note), ''), nullif(max(t.admin_notes), '')) as note,
        max(t.created_at) as latest_ordered_at
      from totals t
      group by t.product_link_id
    ),
    paged as (
      select *
      from grouped
      order by latest_ordered_at desc, product_link_id
      offset ((p_page - 1) * 30) limit 30
    ),
    category_chart as (
      select category, count(*)::integer as ordered_products, sum(total_quantity)::integer as total_quantity, sum(total_weight_kg) as total_weight_kg
      from grouped
      group by category
      order by category
    )
    select jsonb_build_object(
      'rows', coalesce((select jsonb_agg(to_jsonb(paged) order by latest_ordered_at desc, product_link_id) from paged), '[]'::jsonb),
      'total', (select count(*) from grouped),
      'chart', jsonb_build_object(
        'orderedProducts', (select count(*) from grouped),
        'totalQuantity', coalesce((select sum(total_quantity) from grouped), 0),
        'totalWeightKg', (select sum(total_weight_kg) from grouped),
        'categories', coalesce((select jsonb_agg(to_jsonb(category_chart) order by category) from category_chart), '[]'::jsonb)
      )
    )
  );
end;
$$;

revoke all on function public.get_client_product_statement(integer, date, date, date, text, public.order_status) from public, anon;
grant execute on function public.get_client_product_statement(integer, date, date, date, text, public.order_status) to authenticated;

commit;
