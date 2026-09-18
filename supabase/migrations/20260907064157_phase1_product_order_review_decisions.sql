begin;

-- A review decision always applies to the client submission as a whole. This
-- protects the one-link / all-selected-SKUs invariant and delegates each
-- lifecycle write to the canonical transition function so status events and
-- audit rows remain append-only.
create or replace function public.decide_product_order_review(
  p_product_order_id uuid,
  p_decision public.order_status,
  p_reason text
)
returns table (
  product_order_id uuid,
  order_item_ids uuid[],
  order_status public.order_status
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_product_order public.product_orders%rowtype;
  v_line record;
  v_order_item_id uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_count integer := 0;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  if p_decision not in ('cancelled', 'exception') then
    raise exception using errcode = '22023', message = 'review decision must be cancelled or exception';
  end if;

  if v_reason is null then
    raise exception using errcode = '22023', message = 'review decision reason is required';
  end if;

  select * into v_product_order
  from public.product_orders
  where id = p_product_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'product order not found';
  end if;

  for v_line in
    select oi.id, oi.status
    from public.order_items oi
    where oi.product_order_id = v_product_order.id
    order by oi.id
    for update
  loop
    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_line.id);
    if v_line.status <> 'pending_admin_review' then
      raise exception using errcode = '23514', message = 'only a fully pending product order can receive a review decision';
    end if;
  end loop;

  if v_count = 0 then
    raise exception using errcode = 'P0002', message = 'product order has no SKU lines';
  end if;

  foreach v_order_item_id in array v_ids loop
    perform private.change_order_status_internal(v_order_item_id, p_decision, v_reason);
  end loop;

  return query select v_product_order.id, v_ids, p_decision;
end;
$$;

revoke all on function public.decide_product_order_review(uuid, public.order_status, text)
  from public, anon;
grant execute on function public.decide_product_order_review(uuid, public.order_status, text)
  to authenticated, service_role;

commit;
