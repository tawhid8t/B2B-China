begin;

-- Preserve both transient acceptance transitions in audit history even though
-- they occur atomically inside one command.
create trigger estimates_acceptance_transition_audit
after update of status on public.estimates
for each row
when (
  old.status is distinct from new.status
  and new.status in ('accepted', 'converted_to_order')
)
execute function private.audit_row_change();

-- Canonical estimate acceptance endpoint. The existing internal function owns
-- the row locks, idempotent order lookup, active-group assignment, estimate
-- transitions, audit write, and confirmed reservation-only OC-001 behavior.
-- No wallet debit/charge is performed by this command.
create or replace function public.accept_estimate(
  p_estimate_id uuid,
  p_client_id uuid
)
returns table (
  order_item_id uuid,
  group_id uuid,
  group_code text,
  order_status public.order_status,
  wallet_reservation_status text,
  reservation_transaction_id uuid,
  required_amount_cny numeric(14,2),
  reserved_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2),
  wallet_balance_cny numeric(14,2)
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.status = 'active'
      and p.role in ('client', 'admin', 'super_admin')
  ) then
    raise exception using errcode = '42501', message = 'estimate access denied';
  end if;

  return query
  select *
  from private.accept_estimate_with_reservation_internal(
    p_estimate_id,
    p_client_id
  );
end;
$$;

revoke all on function public.accept_estimate(uuid, uuid)
  from public, anon;
grant execute on function public.accept_estimate(uuid, uuid)
  to authenticated, service_role;

-- Retire the implementation-named public RPC from authenticated callers. The
-- private implementation remains available to the canonical checked wrapper.
revoke execute on function public.accept_estimate_with_reservation(uuid, uuid)
  from authenticated;

create or replace function private.reject_estimate_internal(
  p_estimate_id uuid,
  p_reason text
)
returns table (
  estimate_id uuid,
  estimate_status public.estimate_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_estimate public.estimates%rowtype;
  v_before jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role
  into v_role
  from public.profiles p
  where p.id = v_actor
    and p.status = 'active';

  if v_role is null or v_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'estimate access denied';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'rejection reason is required';
  end if;

  select *
  into v_estimate
  from public.estimates e
  where e.id = p_estimate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'estimate not found';
  end if;

  if v_role = 'client' and not exists (
    select 1
    from public.clients c
    where c.id = v_estimate.client_id
      and c.profile_id = v_actor
  ) then
    raise exception using errcode = '42501', message = 'estimate access denied';
  end if;

  -- A repeated rejection is an idempotent success and does not duplicate audit.
  if v_estimate.status = 'rejected' then
    return query select v_estimate.id, v_estimate.status;
    return;
  end if;

  if v_estimate.status <> 'sent_to_client' then
    raise exception using
      errcode = '23514',
      message = 'estimate is not available for rejection';
  end if;

  v_before := to_jsonb(v_estimate);

  update public.estimates
  set status = 'rejected'
  where id = p_estimate_id
  returning * into v_estimate;

  perform private.write_audit_log_internal(
    'estimate',
    v_estimate.id,
    'estimate_rejected',
    v_before,
    to_jsonb(v_estimate),
    btrim(p_reason)
  );

  return query select v_estimate.id, v_estimate.status;
end;
$$;

revoke all on function private.reject_estimate_internal(uuid, text)
  from public, anon;
grant execute on function private.reject_estimate_internal(uuid, text)
  to authenticated, service_role;

create or replace function public.reject_estimate(
  p_estimate_id uuid,
  p_reason text
)
returns table (
  estimate_id uuid,
  estimate_status public.estimate_status
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.reject_estimate_internal(p_estimate_id, p_reason);
$$;

revoke all on function public.reject_estimate(uuid, text)
  from public, anon;
grant execute on function public.reject_estimate(uuid, text)
  to authenticated, service_role;

commit;
