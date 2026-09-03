begin;

-- Phase 2 requires every newly submitted proof to have immutable private
-- evidence. Legacy proof rows remain readable without being rewritten.
alter table public.payment_proofs
  add constraint payment_proofs_file_required
  check (nullif(btrim(proof_file_path), '') is not null) not valid;

create or replace function private.get_current_exchange_rate_internal()
returns table (
  exchange_rate_id uuid,
  cny_to_bdt numeric(10,4),
  source text,
  effective_on date
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.status = 'active';

  if v_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'exchange-rate access denied';
  end if;

  return query
  select er.id, er.cny_to_bdt, er.source, er.effective_on
  from public.exchange_rates er
  where er.effective_on <= current_date
  order by er.effective_on desc, er.created_at desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0002', message = 'current exchange rate not configured';
  end if;
end;
$$;

revoke all on function private.get_current_exchange_rate_internal()
  from public, anon;
grant execute on function private.get_current_exchange_rate_internal()
  to authenticated;

create or replace function public.get_current_exchange_rate()
returns table (
  exchange_rate_id uuid,
  cny_to_bdt numeric(10,4),
  source text,
  effective_on date
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_current_exchange_rate_internal();
$$;

revoke all on function public.get_current_exchange_rate()
  from public, anon, service_role;
grant execute on function public.get_current_exchange_rate()
  to authenticated;

create or replace function private.notify_admins_of_payment_proof()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    profile_id,
    title,
    body,
    entity_type,
    entity_id
  )
  select
    p.id,
    'New payment proof',
    format('A client submitted a BDT %s payment proof for review.', new.amount_bdt),
    'payment_proof',
    new.id
  from public.profiles p
  where p.role in ('admin', 'super_admin')
    and p.status = 'active';

  return new;
end;
$$;

revoke all on function private.notify_admins_of_payment_proof()
  from public, anon, authenticated;

create trigger payment_proofs_notify_admins
after insert on public.payment_proofs
for each row
when (new.status = 'pending'::public.payment_status)
execute function private.notify_admins_of_payment_proof();

create or replace function private.cancel_own_payment_proof_internal(
  p_payment_proof_id uuid
)
returns public.payment_proofs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_proof public.payment_proofs%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.status = 'active';

  if v_role <> 'client'::public.user_role then
    raise exception using errcode = '42501', message = 'client role required';
  end if;

  select pp.* into v_proof
  from public.payment_proofs pp
  join public.clients c on c.id = pp.client_id
  where pp.id = p_payment_proof_id
    and c.profile_id = v_actor
  for update of pp;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment proof not found';
  end if;

  if v_proof.status = 'cancelled'::public.payment_status then
    return v_proof;
  end if;

  if v_proof.status <> 'pending'::public.payment_status then
    raise exception using errcode = '23514', message = 'only a pending payment proof can be cancelled by its client';
  end if;

  perform set_config('app.audit_reason', 'cancelled by submitting client', true);

  update public.payment_proofs pp
  set status = 'cancelled'::public.payment_status
  where pp.id = v_proof.id
  returning pp.* into v_proof;

  perform set_config('app.audit_reason', '', true);
  return v_proof;
end;
$$;

revoke all on function private.cancel_own_payment_proof_internal(uuid)
  from public, anon;
grant execute on function private.cancel_own_payment_proof_internal(uuid)
  to authenticated;

create or replace function public.cancel_own_payment_proof(
  p_payment_proof_id uuid
)
returns public.payment_proofs
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_own_payment_proof_internal(p_payment_proof_id);
$$;

revoke all on function public.cancel_own_payment_proof(uuid)
  from public, anon, service_role;
grant execute on function public.cancel_own_payment_proof(uuid)
  to authenticated;

commit;
