begin;

-- Phase 3 reviews must go through authenticated commands. Direct table updates
-- are removed so terminal proof rows cannot be rewritten through the Data API.
revoke update, delete on public.payment_proofs from authenticated;

alter table public.payment_proofs
  drop constraint payment_proofs_review_metadata_valid,
  add constraint payment_proofs_review_metadata_valid check (
    (status = 'pending'::public.payment_status
      and reviewed_by is null and reviewed_at is null)
    or (status = 'needs_review'::public.payment_status
      and reviewed_by is not null and reviewed_at is not null)
    or (status in ('approved', 'rejected')
      and reviewed_by is not null and reviewed_at is not null)
    or (status = 'cancelled'::public.payment_status
      and ((reviewed_by is null and reviewed_at is null)
        or (reviewed_by is not null and reviewed_at is not null)))
  ) not valid,
  add constraint payment_proofs_approved_amount_required check (
    status <> 'approved'::public.payment_status
    or approved_amount_bdt is not null
  ) not valid;

create or replace function private.prevent_terminal_payment_proof_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status in (
    'approved'::public.payment_status,
    'rejected'::public.payment_status,
    'cancelled'::public.payment_status
  ) and row(
    new.client_id, new.amount_bdt, new.approved_amount_bdt, new.paid_at,
    new.proof_file_path, new.status, new.notes, new.review_reason,
    new.rejection_reason, new.reviewed_by, new.reviewed_at
  ) is distinct from row(
    old.client_id, old.amount_bdt, old.approved_amount_bdt, old.paid_at,
    old.proof_file_path, old.status, old.notes, old.review_reason,
    old.rejection_reason, old.reviewed_by, old.reviewed_at
  ) then
    raise exception 'reviewed payment proofs are immutable; use a linked wallet correction'
      using errcode = '55000';
  end if;
  return new;
end;
$$;

revoke all on function private.prevent_terminal_payment_proof_mutation()
  from public, anon, authenticated;

create trigger payment_proofs_terminal_immutable
before update on public.payment_proofs
for each row execute function private.prevent_terminal_payment_proof_mutation();

drop trigger payment_proofs_audit on public.payment_proofs;
create trigger payment_proofs_audit
after insert or update of status, amount_bdt, approved_amount_bdt,
  review_reason, rejection_reason, reviewed_by, reviewed_at
on public.payment_proofs
for each row execute function private.audit_row_change();

create or replace function private.review_payment_proof_internal(
  p_payment_proof_id uuid,
  p_action text,
  p_verified_amount_bdt numeric default null,
  p_cny_to_bdt_rate numeric default null,
  p_reason text default null
)
returns table (
  payment_proof_id uuid,
  payment_status public.payment_status,
  claimed_amount_bdt numeric(14,2),
  approved_amount_bdt numeric(14,2),
  cny_to_bdt_rate numeric(10,4),
  credited_cny numeric(14,2),
  wallet_transaction_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_action text := lower(nullif(btrim(p_action), ''));
  v_reason text := nullif(btrim(p_reason), '');
  v_proof public.payment_proofs%rowtype;
  v_credit public.wallet_transactions%rowtype;
  v_amount_cny numeric(14,2);
  v_client_profile_id uuid;
  v_title text;
  v_body text;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.status = 'active';

  if v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  if v_action not in ('approve', 'reject', 'needs_review', 'cancel') then
    raise exception using errcode = '22023', message = 'unsupported payment review action';
  end if;

  select pp.* into v_proof
  from public.payment_proofs pp
  where pp.id = p_payment_proof_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'payment proof not found';
  end if;

  select c.profile_id into v_client_profile_id
  from public.clients c
  where c.id = v_proof.client_id;

  -- A retry of the same terminal decision returns the original result. It
  -- never creates a second wallet credit or notification.
  if v_proof.status = 'approved'::public.payment_status and v_action = 'approve' then
    select wt.* into v_credit
    from public.wallet_transactions wt
    where wt.payment_proof_id = v_proof.id
      and wt.transaction_type = 'advance_credit'
      and wt.status = 'posted'
    limit 1;

    if v_credit.id is not null and (
      coalesce(v_proof.approved_amount_bdt, v_proof.amount_bdt) <> p_verified_amount_bdt
      or v_credit.cny_to_bdt_rate <> p_cny_to_bdt_rate
    ) then
      raise exception using errcode = '23514', message = 'approved payment retry does not match the original approval';
    end if;

    return query select
      v_proof.id, v_proof.status, v_proof.amount_bdt,
      v_proof.approved_amount_bdt, v_credit.cny_to_bdt_rate,
      v_credit.amount_cny, v_credit.id, v_proof.reviewed_by,
      v_proof.reviewed_at;
    return;
  end if;

  if (v_proof.status = 'rejected'::public.payment_status and v_action = 'reject')
     or (v_proof.status = 'cancelled'::public.payment_status and v_action = 'cancel') then
    return query select
      v_proof.id, v_proof.status, v_proof.amount_bdt,
      v_proof.approved_amount_bdt, null::numeric(10,4),
      null::numeric(14,2), null::uuid, v_proof.reviewed_by,
      v_proof.reviewed_at;
    return;
  end if;

  if v_proof.status not in ('pending', 'needs_review') then
    raise exception using errcode = '23514', message = 'payment proof has already reached a terminal status';
  end if;

  if v_action = 'approve' then
    if p_verified_amount_bdt is null or p_verified_amount_bdt <= 0
       or p_cny_to_bdt_rate is null or p_cny_to_bdt_rate <= 0 then
      raise exception using errcode = '22023', message = 'positive verified amount and exchange rate are required';
    end if;
    if round(p_verified_amount_bdt, 2) <> v_proof.amount_bdt and v_reason is null then
      raise exception using errcode = '22023', message = 'amount mismatch reason is required';
    end if;

    v_amount_cny := round(round(p_verified_amount_bdt, 2) / round(p_cny_to_bdt_rate, 4), 2);
    if v_amount_cny <= 0 then
      raise exception using errcode = '22023', message = 'verified amount is too small to credit at this exchange rate';
    end if;

    perform set_config('app.audit_reason', coalesce(v_reason, 'payment proof approved'), true);
    update public.payment_proofs pp
    set status = 'approved'::public.payment_status,
        approved_amount_bdt = round(p_verified_amount_bdt, 2),
        review_reason = v_reason,
        rejection_reason = null,
        reviewed_by = v_actor,
        reviewed_at = now()
    where pp.id = v_proof.id
    returning pp.* into v_proof;

    v_credit := private.post_wallet_transaction_internal(
      v_proof.client_id,
      'advance_credit'::public.wallet_transaction_type,
      v_proof.approved_amount_bdt,
      v_amount_cny,
      round(p_cny_to_bdt_rate, 4),
      v_proof.id,
      null, null, null,
      coalesce(v_reason, 'verified payment proof approved'),
      null
    );
    v_title := 'Payment approved';
    v_body := format('Your verified payment of BDT %s credited CNY %s to your wallet.', v_proof.approved_amount_bdt, v_amount_cny);
  elsif v_action = 'reject' then
    if v_reason is null then
      raise exception using errcode = '22023', message = 'rejection reason is required';
    end if;
    perform set_config('app.audit_reason', v_reason, true);
    update public.payment_proofs pp
    set status = 'rejected'::public.payment_status,
        approved_amount_bdt = null,
        review_reason = null,
        rejection_reason = v_reason,
        reviewed_by = v_actor,
        reviewed_at = now()
    where pp.id = v_proof.id
    returning pp.* into v_proof;
    v_title := 'Payment rejected';
    v_body := format('Your payment proof was rejected: %s', v_reason);
  elsif v_action = 'needs_review' then
    if v_reason is null then
      raise exception using errcode = '22023', message = 'review reason is required';
    end if;
    perform set_config('app.audit_reason', v_reason, true);
    update public.payment_proofs pp
    set status = 'needs_review'::public.payment_status,
        approved_amount_bdt = null,
        review_reason = v_reason,
        rejection_reason = null,
        reviewed_by = v_actor,
        reviewed_at = now()
    where pp.id = v_proof.id
    returning pp.* into v_proof;
    v_title := 'Payment needs review';
    v_body := format('Your payment proof needs review: %s', v_reason);
  else
    if v_reason is null then
      raise exception using errcode = '22023', message = 'cancellation reason is required';
    end if;
    perform set_config('app.audit_reason', v_reason, true);
    update public.payment_proofs pp
    set status = 'cancelled'::public.payment_status,
        approved_amount_bdt = null,
        review_reason = v_reason,
        rejection_reason = null,
        reviewed_by = v_actor,
        reviewed_at = now()
    where pp.id = v_proof.id
    returning pp.* into v_proof;
    v_title := 'Payment cancelled';
    v_body := format('Your payment proof was cancelled: %s', v_reason);
  end if;

  insert into public.notifications (profile_id, title, body, entity_type, entity_id)
  values (v_client_profile_id, v_title, v_body, 'payment_proof', v_proof.id);

  perform set_config('app.audit_reason', '', true);

  return query select
    v_proof.id, v_proof.status, v_proof.amount_bdt,
    v_proof.approved_amount_bdt, v_credit.cny_to_bdt_rate,
    v_credit.amount_cny, v_credit.id, v_proof.reviewed_by,
    v_proof.reviewed_at;
end;
$$;

revoke all on function private.review_payment_proof_internal(uuid, text, numeric, numeric, text)
  from public, anon;
grant execute on function private.review_payment_proof_internal(uuid, text, numeric, numeric, text)
  to authenticated;

create or replace function public.review_payment_proof(
  p_payment_proof_id uuid,
  p_action text,
  p_verified_amount_bdt numeric default null,
  p_cny_to_bdt_rate numeric default null,
  p_reason text default null
)
returns table (
  payment_proof_id uuid,
  payment_status public.payment_status,
  claimed_amount_bdt numeric(14,2),
  approved_amount_bdt numeric(14,2),
  cny_to_bdt_rate numeric(10,4),
  credited_cny numeric(14,2),
  wallet_transaction_id uuid,
  reviewed_by uuid,
  reviewed_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.review_payment_proof_internal(
    p_payment_proof_id, p_action, p_verified_amount_bdt,
    p_cny_to_bdt_rate, p_reason
  );
$$;

revoke all on function public.review_payment_proof(uuid, text, numeric, numeric, text)
  from public, anon, service_role;
grant execute on function public.review_payment_proof(uuid, text, numeric, numeric, text)
  to authenticated;

-- Default-rate history remains append-only. Multiple same-day entries are
-- allowed; the latest created row is current for that effective date.
alter table public.exchange_rates
  drop constraint exchange_rates_effective_on_source_key;
create index exchange_rates_effective_created_idx
  on public.exchange_rates (effective_on desc, created_at desc);

revoke insert, update, delete on public.exchange_rates from authenticated;

create or replace function private.create_exchange_rate_internal(
  p_cny_to_bdt numeric,
  p_effective_on date,
  p_source text default 'admin_default'
)
returns public.exchange_rates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_rate public.exchange_rates%rowtype;
begin
  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.status = 'active';

  if v_actor is null or v_role <> 'super_admin'::public.user_role then
    raise exception using errcode = '42501', message = 'super admin role required';
  end if;
  if p_cny_to_bdt is null or p_cny_to_bdt <= 0 then
    raise exception using errcode = '22023', message = 'positive exchange rate required';
  end if;
  if p_effective_on is null or p_effective_on < current_date then
    raise exception using errcode = '22023', message = 'exchange rate effective date cannot be in the past';
  end if;
  if nullif(btrim(p_source), '') is null then
    raise exception using errcode = '22023', message = 'exchange rate source is required';
  end if;

  perform set_config('app.audit_reason', 'new default exchange rate', true);
  insert into public.exchange_rates (cny_to_bdt, source, effective_on, created_by)
  values (round(p_cny_to_bdt, 4), btrim(p_source), p_effective_on, v_actor)
  returning * into v_rate;
  perform set_config('app.audit_reason', '', true);
  return v_rate;
end;
$$;

revoke all on function private.create_exchange_rate_internal(numeric, date, text)
  from public, anon;
grant execute on function private.create_exchange_rate_internal(numeric, date, text)
  to authenticated;

create or replace function public.create_exchange_rate(
  p_cny_to_bdt numeric,
  p_effective_on date,
  p_source text default 'admin_default'
)
returns public.exchange_rates
language sql
security invoker
set search_path = ''
as $$
  select private.create_exchange_rate_internal(p_cny_to_bdt, p_effective_on, p_source);
$$;

revoke all on function public.create_exchange_rate(numeric, date, text)
  from public, anon, service_role;
grant execute on function public.create_exchange_rate(numeric, date, text)
  to authenticated;

commit;
