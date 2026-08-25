-- Core MVP database functions and triggers.
-- This migration is additive and relies on the schema established by 001 and
-- 20260825162319_align_core_schema.sql.

-- The agreed order lifecycle includes purchased, but the prior alignment
-- migration omitted this additive enum value.
alter type public.order_status add value if not exists 'purchased' after 'queued_for_purchase';

begin;

-- Keep the fulfilled-item limit in one place. For the current MVP, an item is
-- fulfilled when its order status reaches completed.
create or replace function private.order_group_fulfilled_limit()
returns integer
language sql
immutable
set search_path = ''
as $$
  select 40;
$$;

revoke all on function private.order_group_fulfilled_limit() from public, anon, authenticated;

-- Central audit writer used by both RPCs and triggers. The actor is always
-- derived from the authenticated session and can never be supplied by callers.
create or replace function private.write_audit_log_internal(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_reason text default null
)
returns public.audit_logs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit public.audit_logs%rowtype;
begin
  if nullif(btrim(p_entity_type), '') is null then
    raise exception using errcode = '22023', message = 'entity_type is required';
  end if;

  if nullif(btrim(p_action), '') is null then
    raise exception using errcode = '22023', message = 'action is required';
  end if;

  insert into public.audit_logs (
    actor_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    reason
  )
  values (
    auth.uid(),
    btrim(p_entity_type),
    p_entity_id,
    btrim(p_action),
    p_before_data,
    p_after_data,
    nullif(btrim(p_reason), '')
  )
  returning * into v_audit;

  return v_audit;
end;
$$;

revoke all on function private.write_audit_log_internal(text, uuid, text, jsonb, jsonb, text)
  from public, anon;
grant execute on function private.write_audit_log_internal(text, uuid, text, jsonb, jsonb, text)
  to authenticated, service_role;

create or replace function public.write_audit_log(
  p_entity_type text,
  p_entity_id uuid,
  p_action text,
  p_before_data jsonb default null,
  p_after_data jsonb default null,
  p_reason text default null
)
returns public.audit_logs
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return private.write_audit_log_internal(
    p_entity_type,
    p_entity_id,
    p_action,
    p_before_data,
    p_after_data,
    p_reason
  );
end;
$$;

revoke all on function public.write_audit_log(text, uuid, text, jsonb, jsonb, text)
  from public, anon;
grant execute on function public.write_audit_log(text, uuid, text, jsonb, jsonb, text)
  to authenticated, service_role;

-- Extend the existing order event trigger so event history and auditing are
-- emitted together from the same status change.
create or replace function private.record_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_from_status public.order_status;
  v_reason text;
begin
  if tg_op = 'INSERT' then
    v_from_status := null;
  elsif new.status is not distinct from old.status then
    return new;
  else
    v_from_status := old.status;
  end if;

  v_reason := nullif(current_setting('app.order_status_reason', true), '');

  insert into public.order_status_events (
    order_item_id,
    from_status,
    to_status,
    changed_by,
    reason
  )
  values (
    new.id,
    v_from_status,
    new.status,
    auth.uid(),
    v_reason
  );

  perform private.write_audit_log_internal(
    'order_item',
    new.id,
    case when tg_op = 'INSERT' then 'order_created' else 'order_status_changed' end,
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    to_jsonb(new),
    v_reason
  );

  return new;
end;
$$;

-- Create a safe default client profile for new Auth users. Role metadata is
-- intentionally ignored so signup cannot grant elevated access.
create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  insert into public.profiles (id, role, full_name, email)
  values (new.id, 'client', v_full_name, new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

-- Recalculate group amounts/counts from their order items. This is the only
-- routine that derives group summaries.
create or replace function private.refresh_order_group_summary(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estimated_total numeric(14, 2);
  v_actual_total numeric(14, 2);
  v_fulfilled_count integer;
begin
  if p_group_id is null then
    return;
  end if;

  select
    coalesce(sum(oi.estimated_total_bdt), 0)::numeric(14, 2),
    coalesce(sum(oi.actual_total_bdt), 0)::numeric(14, 2),
    count(*) filter (where oi.status = 'completed')::integer
  into v_estimated_total, v_actual_total, v_fulfilled_count
  from public.order_items oi
  where oi.group_id = p_group_id;

  update public.order_groups
  set estimated_total_bdt = v_estimated_total,
      actual_total_bdt = v_actual_total,
      fulfilled_item_count = v_fulfilled_count
  where id = p_group_id;
end;
$$;

revoke all on function private.refresh_order_group_summary(uuid)
  from public, anon, authenticated;

create or replace function private.refresh_order_group_summary_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform private.refresh_order_group_summary(old.group_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and (tg_op = 'INSERT' or new.group_id is distinct from old.group_id) then
    perform private.refresh_order_group_summary(new.group_id);
  elsif tg_op = 'UPDATE' then
    perform private.refresh_order_group_summary(new.group_id);
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function private.refresh_order_group_summary_trigger()
  from public, anon, authenticated;

create trigger order_items_refresh_group_after_insert_delete
after insert or delete on public.order_items
for each row execute function private.refresh_order_group_summary_trigger();

create trigger order_items_refresh_group_after_update
after update of group_id, estimated_total_bdt, actual_total_bdt, status
on public.order_items
for each row execute function private.refresh_order_group_summary_trigger();

create or replace function private.close_group_if_fulfilled_limit_reached_internal(
  p_group_id uuid
)
returns public.order_groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_group public.order_groups%rowtype;
begin
  select *
  into v_group
  from public.order_groups
  where id = p_group_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order group not found';
  end if;

  if v_group.status = 'open'
     and v_group.fulfilled_item_count >= private.order_group_fulfilled_limit() then
    update public.order_groups
    set status = 'full',
        closed_at = coalesce(closed_at, now())
    where id = p_group_id
    returning * into v_group;
  end if;

  return v_group;
end;
$$;

revoke all on function private.close_group_if_fulfilled_limit_reached_internal(uuid)
  from public, anon;
grant execute on function private.close_group_if_fulfilled_limit_reached_internal(uuid)
  to authenticated, service_role;

create or replace function public.close_group_if_fulfilled_limit_reached(
  p_group_id uuid
)
returns public.order_groups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return private.close_group_if_fulfilled_limit_reached_internal(p_group_id);
end;
$$;

revoke all on function public.close_group_if_fulfilled_limit_reached(uuid)
  from public, anon;
grant execute on function public.close_group_if_fulfilled_limit_reached(uuid)
  to authenticated, service_role;

create or replace function private.close_group_after_fulfilled_count_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.close_group_if_fulfilled_limit_reached_internal(new.id);
  return new;
end;
$$;

revoke all on function private.close_group_after_fulfilled_count_change()
  from public, anon, authenticated;

create trigger order_groups_close_at_fulfilled_limit
after update of fulfilled_item_count on public.order_groups
for each row
when (new.fulfilled_item_count is distinct from old.fulfilled_item_count)
execute function private.close_group_after_fulfilled_count_change();

create or replace function private.create_or_get_active_order_group_internal(
  p_client_id uuid
)
returns public.order_groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_group public.order_groups%rowtype;
  v_open_count integer;
  v_attempt integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1
       from public.clients c
       where c.id = p_client_id
         and c.profile_id = v_actor
     ) then
    raise exception using errcode = '42501', message = 'client access denied';
  end if;

  perform 1
  from public.clients c
  where c.id = p_client_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  select count(*)::integer
  into v_open_count
  from public.order_groups og
  where og.client_id = p_client_id
    and og.status = 'open';

  if v_open_count > 1 then
    raise exception using errcode = 'P0003', message = 'multiple open order groups require manual resolution';
  end if;

  if v_open_count = 1 then
    select *
    into v_group
    from public.order_groups og
    where og.client_id = p_client_id
      and og.status = 'open'
    for update;

    if v_group.fulfilled_item_count < private.order_group_fulfilled_limit() then
      return v_group;
    end if;

    perform private.close_group_if_fulfilled_limit_reached_internal(v_group.id);
  end if;

  for v_attempt in 1..5 loop
    begin
      insert into public.order_groups (client_id, group_code, status)
      values (
        p_client_id,
        'GRP-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        'open'
      )
      returning * into v_group;

      return v_group;
    exception
      when unique_violation then
        if v_attempt = 5 then
          raise;
        end if;
    end;
  end loop;

  raise exception using errcode = 'P0001', message = 'unable to allocate a unique order group code';
end;
$$;

revoke all on function private.create_or_get_active_order_group_internal(uuid)
  from public, anon;
grant execute on function private.create_or_get_active_order_group_internal(uuid)
  to authenticated, service_role;

create or replace function public.create_or_get_active_order_group(
  p_client_id uuid
)
returns public.order_groups
language sql
security invoker
set search_path = ''
as $$
  select private.create_or_get_active_order_group_internal(p_client_id);
$$;

revoke all on function public.create_or_get_active_order_group(uuid)
  from public, anon;
grant execute on function public.create_or_get_active_order_group(uuid)
  to authenticated, service_role;

-- Wallet balance is always derived from posted ledger entries.
create or replace function public.get_client_wallet_balance(p_client_id uuid)
returns numeric(14, 2)
language plpgsql
security invoker
stable
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_balance numeric(14, 2);
begin
  v_role := public.current_user_role();

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1
       from public.clients c
       where c.id = p_client_id
         and c.profile_id = auth.uid()
     ) then
    raise exception using errcode = '42501', message = 'client access denied';
  end if;

  select coalesce(sum(wt.amount_cny), 0)::numeric(14, 2)
  into v_balance
  from public.wallet_transactions wt
  where wt.client_id = p_client_id
    and wt.status = 'posted';

  return v_balance;
end;
$$;

revoke all on function public.get_client_wallet_balance(uuid) from public, anon;
grant execute on function public.get_client_wallet_balance(uuid)
  to authenticated, service_role;

create unique index wallet_transactions_one_advance_credit_per_proof_idx
on public.wallet_transactions (payment_proof_id)
where payment_proof_id is not null
  and transaction_type = 'advance_credit';

create or replace function public.post_wallet_transaction(
  p_client_id uuid,
  p_transaction_type public.wallet_transaction_type,
  p_amount_bdt numeric,
  p_amount_cny numeric,
  p_cny_to_bdt_rate numeric,
  p_payment_proof_id uuid default null,
  p_order_item_id uuid default null,
  p_order_group_id uuid default null,
  p_product_link_id uuid default null,
  p_notes text default null
)
returns public.wallet_transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_previous_balance numeric(14, 2);
  v_running_balance numeric(14, 2);
  v_transaction public.wallet_transactions%rowtype;
begin
  v_role := public.current_user_role();

  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  if p_transaction_type in ('reservation', 'reservation_release') then
    raise exception using
      errcode = '0A000',
      message = 'wallet reservation behavior requires owner confirmation';
  end if;

  if p_cny_to_bdt_rate is null or p_cny_to_bdt_rate <= 0 then
    raise exception using errcode = '22023', message = 'positive exchange rate required';
  end if;

  if p_amount_bdt is null or p_amount_cny is null
     or p_amount_bdt = 0 or p_amount_cny = 0 then
    raise exception using errcode = '22023', message = 'non-zero BDT and CNY amounts are required';
  end if;

  if (p_amount_bdt > 0) is distinct from (p_amount_cny > 0) then
    raise exception using errcode = '22023', message = 'BDT and CNY amounts must have the same sign';
  end if;

  if p_transaction_type in ('advance_credit', 'refund')
     and (coalesce(p_amount_bdt, 0) <= 0 or coalesce(p_amount_cny, 0) <= 0) then
    raise exception using errcode = '22023', message = 'credit amounts must be positive';
  end if;

  if p_transaction_type = 'order_debit'
     and (coalesce(p_amount_bdt, 0) >= 0 or coalesce(p_amount_cny, 0) >= 0) then
    raise exception using errcode = '22023', message = 'debit amounts must be negative';
  end if;

  if p_transaction_type = 'adjustment' and nullif(btrim(p_notes), '') is null then
    raise exception using errcode = '22023', message = 'adjustment reason is required';
  end if;

  if p_transaction_type = 'advance_credit' then
    if p_payment_proof_id is null then
      raise exception using errcode = '22023', message = 'payment proof is required for advance credit';
    end if;

    if not exists (
      select 1
      from public.payment_proofs pp
      where pp.id = p_payment_proof_id
        and pp.client_id = p_client_id
        and pp.status = 'approved'
    ) then
      raise exception using errcode = '23514', message = 'payment proof must be approved for this client';
    end if;
  end if;

  if p_transaction_type = 'order_debit' and p_order_item_id is null then
    raise exception using errcode = '22023', message = 'order item is required for order debit';
  end if;

  perform 1
  from public.clients c
  where c.id = p_client_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  select coalesce(sum(wt.amount_cny), 0)::numeric(14, 2)
  into v_previous_balance
  from public.wallet_transactions wt
  where wt.client_id = p_client_id
    and wt.status = 'posted';

  v_running_balance := (v_previous_balance + p_amount_cny)::numeric(14, 2);

  if p_transaction_type = 'order_debit' and v_running_balance < 0 then
    raise exception using errcode = '23514', message = 'wallet debit exceeds available balance';
  end if;

  insert into public.wallet_transactions (
    client_id,
    transaction_type,
    amount_bdt,
    amount_cny,
    cny_to_bdt_rate,
    running_balance_cny,
    status,
    payment_proof_id,
    order_item_id,
    order_group_id,
    product_link_id,
    notes,
    approved_by,
    created_by
  )
  values (
    p_client_id,
    p_transaction_type,
    p_amount_bdt,
    p_amount_cny,
    p_cny_to_bdt_rate,
    v_running_balance,
    'posted',
    p_payment_proof_id,
    p_order_item_id,
    p_order_group_id,
    p_product_link_id,
    nullif(btrim(p_notes), ''),
    v_actor,
    v_actor
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

revoke all on function public.post_wallet_transaction(
  uuid, public.wallet_transaction_type, numeric, numeric, numeric,
  uuid, uuid, uuid, uuid, text
) from public, anon;
grant execute on function public.post_wallet_transaction(
  uuid, public.wallet_transaction_type, numeric, numeric, numeric,
  uuid, uuid, uuid, uuid, text
) to authenticated, service_role;

create or replace function public.approve_payment_proof(
  p_payment_proof_id uuid,
  p_amount_bdt numeric,
  p_cny_to_bdt_rate numeric,
  p_notes text default null
)
returns table (
  payment_proof_id uuid,
  wallet_transaction_id uuid,
  credited_amount_cny numeric(14, 2),
  running_balance_cny numeric(14, 2)
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_proof public.payment_proofs%rowtype;
  v_transaction public.wallet_transactions%rowtype;
  v_amount_cny numeric(14, 2);
begin
  v_role := public.current_user_role();

  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  if p_amount_bdt is null or p_amount_bdt <= 0 then
    raise exception using errcode = '22023', message = 'positive payment amount required';
  end if;

  if p_cny_to_bdt_rate is null or p_cny_to_bdt_rate <= 0 then
    raise exception using errcode = '22023', message = 'positive exchange rate required';
  end if;

  select *
  into v_proof
  from public.payment_proofs pp
  where pp.id = p_payment_proof_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment proof not found';
  end if;

  if v_proof.status = 'approved' then
    select *
    into v_transaction
    from public.wallet_transactions wt
    where wt.payment_proof_id = p_payment_proof_id
      and wt.transaction_type = 'advance_credit'
      and wt.status = 'posted';

    if not found then
      raise exception using errcode = 'P0001', message = 'approved proof is missing its posted wallet credit';
    end if;

    return query select
      v_proof.id,
      v_transaction.id,
      v_transaction.amount_cny,
      v_transaction.running_balance_cny;
    return;
  end if;

  if v_proof.status not in ('pending', 'needs_review') then
    raise exception using errcode = '23514', message = 'payment proof is not approvable';
  end if;

  v_amount_cny := round(p_amount_bdt / p_cny_to_bdt_rate, 2);

  perform set_config('app.audit_reason', coalesce(nullif(btrim(p_notes), ''), 'payment proof approved'), true);

  update public.payment_proofs
  set amount_bdt = p_amount_bdt,
      status = 'approved',
      reviewed_by = v_actor,
      reviewed_at = now(),
      notes = coalesce(nullif(btrim(p_notes), ''), notes)
  where id = p_payment_proof_id
  returning * into v_proof;

  select *
  into v_transaction
  from public.post_wallet_transaction(
    v_proof.client_id,
    'advance_credit',
    p_amount_bdt,
    v_amount_cny,
    p_cny_to_bdt_rate,
    v_proof.id,
    null,
    null,
    null,
    p_notes
  );

  perform set_config('app.audit_reason', '', true);

  return query select
    v_proof.id,
    v_transaction.id,
    v_amount_cny,
    v_transaction.running_balance_cny;
end;
$$;

revoke all on function public.approve_payment_proof(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function public.approve_payment_proof(uuid, numeric, numeric, text)
  to authenticated, service_role;

-- Explicit order transition command. It owns the transition matrix while the
-- existing status trigger owns history/audit emission.
create or replace function private.change_order_status_internal(
  p_order_item_id uuid,
  p_to_status public.order_status,
  p_reason text default null
)
returns public.order_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_order public.order_items%rowtype;
  v_previous_status public.order_status;
  v_is_owner boolean;
  v_allowed boolean := false;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  select *
  into v_order
  from public.order_items oi
  where oi.id = p_order_item_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'order item not found';
  end if;

  if v_order.status = p_to_status then
    return v_order;
  end if;

  if v_order.status in ('completed', 'cancelled') then
    raise exception using errcode = '23514', message = 'terminal order statuses cannot be reopened';
  end if;

  select exists (
    select 1
    from public.clients c
    where c.id = v_order.client_id
      and c.profile_id = v_actor
  ) into v_is_owner;

  if p_to_status = 'exception' then
    v_allowed := v_role in ('super_admin', 'admin', 'staff_receiver', 'staff_packer');
    if v_reason is null then
      raise exception using errcode = '22023', message = 'exception reason is required';
    end if;
  elsif p_to_status = 'cancelled' then
    v_allowed := v_role in ('super_admin', 'admin')
      or (v_order.status = 'pending_admin_review' and v_role = 'client' and v_is_owner);
    if v_reason is null then
      raise exception using errcode = '22023', message = 'cancellation reason is required';
    end if;
  elsif v_order.status = 'exception' then
    if v_role not in ('super_admin', 'admin') then
      raise exception using errcode = '42501', message = 'admin role required to resolve exception';
    end if;

    select ose.from_status
    into v_previous_status
    from public.order_status_events ose
    where ose.order_item_id = p_order_item_id
      and ose.to_status = 'exception'
    order by ose.created_at desc, ose.id desc
    limit 1;

    v_allowed := v_previous_status is not null and p_to_status = v_previous_status;
    if v_reason is null then
      raise exception using errcode = '22023', message = 'exception resolution reason is required';
    end if;
  else
    v_allowed := case
      when v_order.status = 'pending_admin_review' and p_to_status = 'confirmed'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'confirmed' and p_to_status = 'queued_for_purchase'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'queued_for_purchase' and p_to_status = 'purchased'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'purchased' and p_to_status = 'seller_shipped'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'seller_shipped' and p_to_status = 'received_china'
        then v_role in ('super_admin', 'admin', 'staff_receiver')
      when v_order.status = 'received_china' and p_to_status = 'qc_checked'
        then v_role in ('super_admin', 'admin', 'staff_receiver')
      when v_order.status = 'qc_checked' and p_to_status = 'packed'
        then v_role in ('super_admin', 'admin', 'staff_packer')
      when v_order.status = 'packed' and p_to_status = 'sent_guangzhou'
        then v_role in ('super_admin', 'admin', 'staff_packer')
      when v_order.status = 'sent_guangzhou' and p_to_status = 'arrived_guangzhou'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'arrived_guangzhou' and p_to_status = 'sent_bangladesh'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'sent_bangladesh' and p_to_status = 'arrived_bangladesh'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'arrived_bangladesh' and p_to_status = 'ready_for_pickup'
        then v_role in ('super_admin', 'admin')
      when v_order.status = 'ready_for_pickup' and p_to_status = 'completed'
        then v_role in ('super_admin', 'admin')
      else false
    end;
  end if;

  if not v_allowed then
    raise exception using errcode = '23514', message = 'invalid or unauthorized order status transition';
  end if;

  if v_order.status = 'queued_for_purchase' and p_to_status = 'purchased'
     and not exists (
       select 1
       from public.provider_orders po
       where po.order_item_id = p_order_item_id
         and (po.provider_order_id is not null or po.paid_amount_cny is not null)
     )
     and v_reason is null then
    raise exception using
      errcode = '23514',
      message = 'purchase evidence or an audited admin override reason is required';
  end if;

  if v_order.status = 'qc_checked' and p_to_status = 'packed' then
    if not exists (
      select 1 from public.parcel_items pi where pi.order_item_id = p_order_item_id
    ) or exists (
      select 1
      from public.parcel_items pi
      where pi.order_item_id = p_order_item_id
        and (
          pi.qc_status not in ('pass', 'admin_approved')
          or pi.received_pieces is null
          or pi.weight_kg is null
        )
    ) then
      raise exception using errcode = '23514', message = 'packing requires completed passing or admin-approved QC';
    end if;
  end if;

  perform set_config('app.order_status_reason', coalesce(v_reason, ''), true);

  update public.order_items
  set status = p_to_status
  where id = p_order_item_id
  returning * into v_order;

  perform set_config('app.order_status_reason', '', true);

  return v_order;
end;
$$;

revoke all on function private.change_order_status_internal(uuid, public.order_status, text)
  from public, anon;
grant execute on function private.change_order_status_internal(uuid, public.order_status, text)
  to authenticated, service_role;

create or replace function public.change_order_status(
  p_order_item_id uuid,
  p_to_status public.order_status,
  p_reason text default null
)
returns public.order_items
language sql
security invoker
set search_path = ''
as $$
  select private.change_order_status_internal(p_order_item_id, p_to_status, p_reason);
$$;

revoke all on function public.change_order_status(uuid, public.order_status, text)
  from public, anon;
grant execute on function public.change_order_status(uuid, public.order_status, text)
  to authenticated, service_role;

-- Shared audit trigger for the remaining critical mutable records.
create or replace function private.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entity_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_reason text;
begin
  v_before := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  v_after := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_entity_id := coalesce((v_after ->> 'id')::uuid, (v_before ->> 'id')::uuid);
  v_reason := nullif(current_setting('app.audit_reason', true), '');

  perform private.write_audit_log_internal(
    tg_table_name,
    v_entity_id,
    lower(tg_op),
    v_before,
    v_after,
    v_reason
  );

  return coalesce(new, old);
end;
$$;

revoke all on function private.audit_row_change() from public, anon, authenticated;

create trigger payment_proofs_audit
after insert or update of status, amount_bdt, reviewed_by, reviewed_at
on public.payment_proofs
for each row execute function private.audit_row_change();

create trigger wallet_transactions_audit
after insert or update of status
on public.wallet_transactions
for each row execute function private.audit_row_change();

create trigger order_groups_status_audit
after update of status on public.order_groups
for each row
when (new.status is distinct from old.status)
execute function private.audit_row_change();

create trigger exchange_rates_audit
after insert or update or delete on public.exchange_rates
for each row execute function private.audit_row_change();

create trigger shipping_rates_audit
after insert or update or delete on public.shipping_rates
for each row execute function private.audit_row_change();

create trigger profit_rules_audit
after insert or update or delete on public.profit_rules
for each row execute function private.audit_row_change();

create trigger category_rules_audit
after insert or update or delete on public.category_rules
for each row execute function private.audit_row_change();

commit;
