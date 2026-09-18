begin;

-- The function's output column is named product_order_id. Qualifying the
-- order_items reference avoids PL/pgSQL resolving that name as its output
-- variable, which previously prevented every live confirmation.
create or replace function public.confirm_product_order_for_purchase(
  p_product_order_id uuid
)
returns table (
  product_order_id uuid,
  purchase_batch_id uuid,
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
  v_batch public.purchase_batches%rowtype;
  v_existing_batch_id uuid;
  v_order_item_id uuid;
  v_ids uuid[] := '{}'::uuid[];
  v_count integer := 0;
  v_pending integer := 0;
  v_confirmed integer := 0;
  v_queued integer := 0;
begin
  if v_actor is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  select * into v_product_order
  from public.product_orders po
  where po.id = p_product_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'product order not found';
  end if;

  for v_line in
    select oi.id, oi.status
    from public.order_items oi
    where oi.product_order_id = p_product_order_id
    order by oi.id
    for update
  loop
    v_count := v_count + 1;
    v_ids := array_append(v_ids, v_line.id);
    if v_line.status = 'pending_admin_review' then v_pending := v_pending + 1; end if;
    if v_line.status = 'confirmed' then v_confirmed := v_confirmed + 1; end if;
    if v_line.status = 'queued_for_purchase' then v_queued := v_queued + 1; end if;
  end loop;

  if v_count = 0 then
    raise exception using errcode = 'P0002', message = 'product order has no SKU lines';
  end if;

  if v_queued = v_count then
    select pbi.purchase_batch_id into v_existing_batch_id
    from public.purchase_batch_items pbi
    where pbi.order_item_id = any(v_ids)
    order by pbi.created_at desc
    limit 1;
    if v_existing_batch_id is null then
      raise exception using errcode = 'P0001', message = 'queued product order is missing its purchase batch';
    end if;
    return query select p_product_order_id, v_existing_batch_id, v_ids, 'queued_for_purchase'::public.order_status;
    return;
  end if;

  if v_pending <> 0 and v_pending <> v_count then
    raise exception using errcode = '23514', message = 'product order has mixed SKU statuses and cannot be confirmed';
  end if;
  if v_pending = 0 and v_confirmed <> v_count then
    raise exception using errcode = '23514', message = 'only pending or fully confirmed product orders can enter purchasing';
  end if;

  if v_pending = v_count then
    foreach v_order_item_id in array v_ids loop
      perform private.change_order_status_internal(
        v_order_item_id,
        'confirmed',
        'approved with every SKU in product order'
      );
    end loop;
  end if;

  insert into public.purchase_batches (batch_code, status, created_by)
  values (
    'PB-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    'sent_to_extension',
    v_actor
  )
  returning * into v_batch;

  foreach v_order_item_id in array v_ids loop
    insert into public.purchase_batch_items (purchase_batch_id, order_item_id, status)
    values (v_batch.id, v_order_item_id, 'queued');
    perform private.change_order_status_internal(
      v_order_item_id,
      'queued_for_purchase',
      'queued with every SKU in product order for extension-assisted purchase'
    );
  end loop;

  return query select p_product_order_id, v_batch.id, v_ids, 'queued_for_purchase'::public.order_status;
end;
$$;

revoke all on function public.confirm_product_order_for_purchase(uuid) from public, anon;
grant execute on function public.confirm_product_order_for_purchase(uuid) to authenticated, service_role;

commit;
