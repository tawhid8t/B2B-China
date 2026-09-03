begin;

-- Phase 1: additive wallet/payment foundations. Existing approved financial
-- rows remain untouched; new nullable fields are populated only by the review
-- and correction commands introduced in later phases.

alter table public.payment_proofs
  add column approved_amount_bdt numeric(14,2),
  add column review_reason text,
  add constraint payment_proofs_approved_amount_positive
    check (approved_amount_bdt is null or approved_amount_bdt > 0),
  add constraint payment_proofs_approved_amount_state_valid
    check (
      approved_amount_bdt is null
      or status = 'approved'::public.payment_status
    ),
  add constraint payment_proofs_review_reason_required
    check (
      status <> 'needs_review'::public.payment_status
      or nullif(btrim(review_reason), '') is not null
    ) not valid,
  add constraint payment_proofs_mismatch_reason_required
    check (
      approved_amount_bdt is null
      or approved_amount_bdt = amount_bdt
      or nullif(btrim(review_reason), '') is not null
    );

comment on column public.payment_proofs.amount_bdt is
  'Client-claimed BDT amount. Approval must not overwrite this historical claim.';
comment on column public.payment_proofs.approved_amount_bdt is
  'Admin-verified BDT amount. Legacy approved rows may be null and are interpreted using amount_bdt.';
comment on column public.payment_proofs.review_reason is
  'Required prospectively for needs-review decisions and claimed-versus-approved amount mismatches; legacy rows are preserved.';

alter policy payment_proofs_insert_own_pending
on public.payment_proofs
with check (
  (select public.current_user_role()) = 'client'
  and client_id in (
    select id from public.clients where profile_id = (select auth.uid())
  )
  and status = 'pending'::public.payment_status
  and approved_amount_bdt is null
  and review_reason is null
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
);

alter table public.wallet_transactions
  add column corrects_transaction_id uuid
    references public.wallet_transactions(id) on delete restrict,
  add constraint wallet_transactions_correction_not_self
    check (corrects_transaction_id is null or corrects_transaction_id <> id),
  add constraint wallet_transactions_correction_type_valid
    check (
      corrects_transaction_id is null
      or transaction_type in ('refund', 'adjustment')
    ),
  add constraint wallet_transactions_correction_reason_required
    check (
      corrects_transaction_id is null
      or nullif(btrim(notes), '') is not null
    );

comment on column public.wallet_transactions.corrects_transaction_id is
  'Links an immutable refund/adjustment to the posted transaction it partially or fully corrects.';

create or replace function private.validate_wallet_correction_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_original public.wallet_transactions%rowtype;
  v_corrected_cny numeric(14,2);
  v_corrected_bdt numeric(14,2);
begin
  if new.corrects_transaction_id is null then
    return new;
  end if;

  select * into v_original
  from public.wallet_transactions wt
  where wt.id = new.corrects_transaction_id
  for update;

  if not found then
    raise exception using errcode = '23503', message = 'corrected wallet transaction not found';
  end if;

  if v_original.status <> 'posted'::public.wallet_transaction_status
     or v_original.transaction_type in ('reservation', 'reservation_release')
     or v_original.corrects_transaction_id is not null then
    raise exception using errcode = '23514', message = 'only a posted base financial transaction can be corrected';
  end if;

  if new.client_id <> v_original.client_id
     or new.cny_to_bdt_rate <> v_original.cny_to_bdt_rate then
    raise exception using errcode = '23514', message = 'wallet correction must preserve client and exchange rate';
  end if;

  if sign(new.amount_cny) = sign(v_original.amount_cny)
     or sign(new.amount_bdt) = sign(v_original.amount_bdt) then
    raise exception using errcode = '23514', message = 'wallet correction must have the opposite financial effect';
  end if;

  select
    coalesce(sum(abs(wt.amount_cny)), 0),
    coalesce(sum(abs(wt.amount_bdt)), 0)
  into v_corrected_cny, v_corrected_bdt
  from public.wallet_transactions wt
  where wt.corrects_transaction_id = v_original.id
    and wt.status <> 'cancelled'::public.wallet_transaction_status
    and wt.id is distinct from new.id;

  if v_corrected_cny + abs(new.amount_cny) > abs(v_original.amount_cny)
     or v_corrected_bdt + abs(new.amount_bdt) > abs(v_original.amount_bdt) then
    raise exception using errcode = '23514', message = 'wallet corrections cannot exceed the original transaction';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_wallet_correction_link()
  from public, anon, authenticated;

create trigger wallet_transactions_validate_correction
before insert or update of corrects_transaction_id, client_id, amount_bdt,
  amount_cny, cny_to_bdt_rate, status
on public.wallet_transactions
for each row execute function private.validate_wallet_correction_link();

create unique index wallet_transactions_one_posted_credit_per_proof_idx
  on public.wallet_transactions (payment_proof_id)
  where payment_proof_id is not null
    and transaction_type = 'advance_credit'
    and status = 'posted';

create index wallet_transactions_correction_target_idx
  on public.wallet_transactions (corrects_transaction_id)
  where corrects_transaction_id is not null;

create index wallet_transactions_client_posted_created_idx
  on public.wallet_transactions (client_id, created_at desc)
  where status = 'posted';

create index payment_proofs_review_queue_idx
  on public.payment_proofs (status, created_at desc)
  where status in ('pending', 'needs_review');

create table public.payment_instructions (
  id uuid primary key default gen_random_uuid(),
  method text not null check (nullif(btrim(method), '') is not null),
  label text not null check (nullif(btrim(label), '') is not null),
  account_name text,
  account_identifier text,
  instructions text,
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  created_by uuid references public.profiles(id) on delete restrict,
  updated_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_instructions_destination_present check (
    nullif(btrim(account_identifier), '') is not null
    or nullif(btrim(instructions), '') is not null
  )
);

comment on table public.payment_instructions is
  'Super-admin managed client-visible bank and mobile-wallet payment destinations.';

create index payment_instructions_active_order_idx
  on public.payment_instructions (sort_order, created_at)
  where active;
create index payment_instructions_created_by_idx
  on public.payment_instructions (created_by);
create index payment_instructions_updated_by_idx
  on public.payment_instructions (updated_by);

create trigger payment_instructions_set_updated_at
before update on public.payment_instructions
for each row execute function private.set_updated_at();

create trigger payment_instructions_audit
after insert or update on public.payment_instructions
for each row execute function private.audit_row_change();

alter table public.payment_instructions enable row level security;

revoke all on public.payment_instructions from public, anon, authenticated;
grant select, insert, update on public.payment_instructions to authenticated;
grant all on public.payment_instructions to service_role;

create policy payment_instructions_client_admin_select
on public.payment_instructions for select to authenticated
using (
  (active and (select public.current_user_role()) = 'client')
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

create policy payment_instructions_owner_insert
on public.payment_instructions for insert to authenticated
with check (
  (select public.current_user_role()) = 'super_admin'
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy payment_instructions_owner_update
on public.payment_instructions for update to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check (
  (select public.current_user_role()) = 'super_admin'
  and updated_by = (select auth.uid())
);

-- Exchange-rate history is append-only. A changed default is represented by a
-- newer effective row, never by editing the rate snapshotted by old records.
create or replace function private.prevent_exchange_rate_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'exchange-rate history is append-only; create a newly effective rate'
    using errcode = '55000';
end;
$$;

revoke all on function private.prevent_exchange_rate_mutation()
  from public, anon, authenticated;

create trigger exchange_rates_append_only
before update or delete on public.exchange_rates
for each row execute function private.prevent_exchange_rate_mutation();

insert into public.exchange_rates (
  cny_to_bdt,
  source,
  effective_on,
  created_by
)
values (
  19.2000,
  'system_default',
  date '2026-08-30',
  null
)
on conflict (effective_on, source) do nothing;

-- Canonical wallet totals. Reservations reduce available balance but are not
-- spent funds; the matching release removes the hold before the order debit.
create or replace function public.get_client_wallet_totals(p_client_id uuid)
returns table (
  total_funds_cny numeric(14,2),
  active_reserved_cny numeric(14,2),
  available_balance_cny numeric(14,2)
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role := public.current_user_role();
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  if v_role = 'client' and not exists (
    select 1
    from public.clients c
    where c.id = p_client_id
      and c.profile_id = v_actor
  ) then
    raise exception using errcode = '42501', message = 'wallet access denied';
  end if;

  if v_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'wallet access denied';
  end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id) then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  return query
  select
    coalesce(sum(wt.amount_cny) filter (
      where wt.status = 'posted'
        and wt.transaction_type not in ('reservation', 'reservation_release')
    ), 0)::numeric(14,2) as total_funds_cny,
    greatest(
      -coalesce(sum(wt.amount_cny) filter (
        where wt.status = 'posted'
          and wt.transaction_type in ('reservation', 'reservation_release')
      ), 0),
      0
    )::numeric(14,2) as active_reserved_cny,
    coalesce(sum(wt.amount_cny) filter (
      where wt.status = 'posted'
    ), 0)::numeric(14,2) as available_balance_cny
  from public.wallet_transactions wt
  where wt.client_id = p_client_id;
end;
$$;

revoke all on function public.get_client_wallet_totals(uuid)
  from public, anon, service_role;
grant execute on function public.get_client_wallet_totals(uuid)
  to authenticated;

-- Private proof bucket. Direct uploads, when Phase 2 activates them, use the
-- authenticated profile UUID as the first path segment. No overwrite/delete
-- policies are granted, keeping submitted evidence immutable from app flows.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy payment_proof_objects_client_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'payment-proofs'
  and (select public.current_user_role()) = 'client'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy payment_proof_objects_client_select
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and (select public.current_user_role()) = 'client'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy payment_proof_objects_admin_select
on storage.objects for select to authenticated
using (
  bucket_id = 'payment-proofs'
  and (select public.current_user_role()) in ('admin', 'super_admin')
);

commit;
