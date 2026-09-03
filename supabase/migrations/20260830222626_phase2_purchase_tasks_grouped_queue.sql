begin;

-- Product-wide coordination state. SKU order_items and purchase_batch_items
-- remain the purchasing and fulfillment source of truth.
create table public.purchase_tasks (
  id uuid primary key default gen_random_uuid(),
  product_order_id uuid not null unique references public.product_orders(id) on delete restrict,
  purchase_batch_id uuid not null unique references public.purchase_batches(id) on delete restrict,
  state text not null default 'queued' check (state in (
    'queued', 'cart_added', 'awaiting_provider_details',
    'awaiting_admin_confirmation', 'needs_review', 'confirmed'
  )),
  cart_added_at timestamptz,
  cart_added_by uuid references public.profiles(id) on delete restrict,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index purchase_tasks_state_created_idx
  on public.purchase_tasks (state, created_at desc);

create trigger purchase_tasks_set_updated_at
before update on public.purchase_tasks
for each row execute function private.set_updated_at();

alter table public.purchase_tasks enable row level security;
revoke all on table public.purchase_tasks from public, anon;
grant select, update on table public.purchase_tasks to authenticated;

create policy purchase_tasks_admin_select
on public.purchase_tasks for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy purchase_tasks_admin_update
on public.purchase_tasks for update to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create or replace function private.create_purchase_task_for_batch_item()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_order_id uuid;
begin
  select product_order_id into v_product_order_id
  from public.order_items
  where id = new.order_item_id;
  if v_product_order_id is null then
    raise exception using errcode = 'P0001', message = 'purchase batch item is missing its product order';
  end if;

  insert into public.purchase_tasks (product_order_id, purchase_batch_id)
  values (v_product_order_id, new.purchase_batch_id)
  on conflict (product_order_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_purchase_task_for_batch_item() from public, anon;

drop trigger if exists purchase_batch_items_create_product_task on public.purchase_batch_items;
create trigger purchase_batch_items_create_product_task
after insert on public.purchase_batch_items
for each row execute function private.create_purchase_task_for_batch_item();

insert into public.purchase_tasks (product_order_id, purchase_batch_id, state, created_at)
select distinct on (oi.product_order_id)
  oi.product_order_id,
  pbi.purchase_batch_id,
  case when pb.status in ('purchased', 'closed') then 'confirmed' else 'queued' end,
  pbi.created_at
from public.purchase_batch_items pbi
join public.order_items oi on oi.id = pbi.order_item_id
join public.purchase_batches pb on pb.id = pbi.purchase_batch_id
order by oi.product_order_id, pbi.created_at desc
on conflict (product_order_id) do nothing;

create or replace function private.record_purchase_task_cart_result_internal(
  p_actor_id uuid,
  p_purchase_task_id uuid,
  p_order_item_ids uuid[],
  p_cart_added boolean,
  p_message text default null
)
returns table (purchase_task_id uuid, purchase_task_state text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
  v_task public.purchase_tasks%rowtype;
  v_expected_ids uuid[];
  v_received_ids uuid[];
  v_before jsonb;
begin
  select * into v_profile from public.profiles where id = p_actor_id;
  if not found or v_profile.status <> 'active' or v_profile.role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'active admin role required';
  end if;
  if p_order_item_ids is null or cardinality(p_order_item_ids) = 0 then
    raise exception using errcode = '22023', message = 'every product-order SKU line is required';
  end if;

  select * into v_task
  from public.purchase_tasks
  where id = p_purchase_task_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'purchase task not found';
  end if;
  if v_task.state in ('confirmed', 'awaiting_admin_confirmation') then
    raise exception using errcode = '23514', message = 'purchase task can no longer accept cart results';
  end if;

  select array_agg(id order by id) into v_expected_ids
  from public.order_items
  where product_order_id = v_task.product_order_id
    and status = 'queued_for_purchase';
  select array_agg(distinct id order by id) into v_received_ids
  from unnest(p_order_item_ids) as line(id);
  if v_expected_ids is null or v_expected_ids is distinct from v_received_ids then
    raise exception using errcode = '23514', message = 'cart result must include every queued SKU line exactly once';
  end if;

  v_before := to_jsonb(v_task);
  if p_cart_added then
    update public.purchase_tasks
    set state = 'cart_added',
        cart_added_at = coalesce(cart_added_at, now()),
        cart_added_by = coalesce(cart_added_by, p_actor_id),
        last_error = null
    where id = v_task.id
    returning * into v_task;
  else
    if nullif(btrim(coalesce(p_message, '')), '') is null then
      raise exception using errcode = '22023', message = 'a cart failure message is required';
    end if;
    update public.purchase_tasks
    set state = 'needs_review', last_error = btrim(p_message)
    where id = v_task.id
    returning * into v_task;
  end if;

  perform private.write_audit_log_internal(
    'purchase_task', v_task.id,
    case when p_cart_added then 'purchase_task_cart_added' else 'purchase_task_needs_review' end,
    v_before, to_jsonb(v_task), nullif(btrim(coalesce(p_message, '')), '')
  );
  return query select v_task.id, v_task.state, v_task.updated_at;
end;
$$;

revoke all on function private.record_purchase_task_cart_result_internal(uuid, uuid, uuid[], boolean, text) from public, anon;

create or replace function public.record_purchase_task_cart_result(
  p_purchase_task_id uuid,
  p_order_item_ids uuid[],
  p_cart_added boolean,
  p_message text default null
)
returns table (purchase_task_id uuid, purchase_task_state text, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  return query select * from private.record_purchase_task_cart_result_internal(
    (select auth.uid()), p_purchase_task_id, p_order_item_ids, p_cart_added, p_message
  );
end;
$$;

revoke all on function public.record_purchase_task_cart_result(uuid, uuid[], boolean, text) from public, anon;
grant execute on function public.record_purchase_task_cart_result(uuid, uuid[], boolean, text) to authenticated, service_role;

create or replace function public.record_purchase_task_cart_result_for_credential(
  p_profile_id uuid,
  p_purchase_task_id uuid,
  p_order_item_ids uuid[],
  p_cart_added boolean,
  p_message text default null
)
returns table (purchase_task_id uuid, purchase_task_state text, updated_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query select * from private.record_purchase_task_cart_result_internal(
    p_profile_id, p_purchase_task_id, p_order_item_ids, p_cart_added, p_message
  );
end;
$$;

revoke all on function public.record_purchase_task_cart_result_for_credential(uuid, uuid, uuid[], boolean, text) from public, anon, authenticated;
grant execute on function public.record_purchase_task_cart_result_for_credential(uuid, uuid, uuid[], boolean, text) to service_role;

create or replace function public.set_purchase_task_state(
  p_purchase_task_id uuid,
  p_state text,
  p_reason text default null
)
returns table (purchase_task_id uuid, purchase_task_state text, updated_at timestamptz)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_task public.purchase_tasks%rowtype;
  v_before jsonb;
begin
  if (select auth.uid()) is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if p_state not in ('queued', 'needs_review') then
    raise exception using errcode = '22023', message = 'only queued or needs_review task states can be set manually';
  end if;
  if p_state = 'needs_review' and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception using errcode = '22023', message = 'a manual-review reason is required';
  end if;
  select * into v_task from public.purchase_tasks where id = p_purchase_task_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'purchase task not found'; end if;
  if v_task.state in ('confirmed', 'awaiting_admin_confirmation') then
    raise exception using errcode = '23514', message = 'purchase task can no longer be changed manually';
  end if;
  v_before := to_jsonb(v_task);
  update public.purchase_tasks
  set state = p_state,
      last_error = case when p_state = 'needs_review' then btrim(p_reason) else null end
  where id = v_task.id
  returning * into v_task;
  perform private.write_audit_log_internal('purchase_task', v_task.id,
    'purchase_task_state_changed', v_before, to_jsonb(v_task), nullif(btrim(coalesce(p_reason, '')), ''));
  return query select v_task.id, v_task.state, v_task.updated_at;
end;
$$;

revoke all on function public.set_purchase_task_state(uuid, text, text) from public, anon;
grant execute on function public.set_purchase_task_state(uuid, text, text) to authenticated, service_role;

commit;
