-- Phase 6: role-scoped notification inboxes, wallet lifecycle notifications,
-- protected financial summaries, and a reconciliation read model.

alter table public.notifications
  add column if not exists event_type text not null default 'general';

alter table public.notifications
  drop constraint if exists notifications_event_type_check;

alter table public.notifications
  add constraint notifications_event_type_check check (event_type in (
    'general',
    'payment_proof_submitted',
    'payment_review_result',
    'wallet_insufficient',
    'reservation_released',
    'wallet_corrected'
  ));

create index if not exists notifications_profile_created_idx
  on public.notifications (profile_id, created_at desc);

create index if not exists notifications_profile_unread_idx
  on public.notifications (profile_id, created_at desc)
  where read_at is null;

-- Admins receive their own copies of operational notifications. They must not
-- browse messages addressed to other administrators or clients.
drop policy if exists "users read own notifications" on public.notifications;
create policy notifications_select_own
on public.notifications for select
to authenticated
using (profile_id = (select auth.uid()));

revoke insert, delete, truncate on public.notifications from authenticated;
revoke update on public.notifications from authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Existing payment notification producers predate event_type. Classify those
-- rows at insertion without rewriting their proven approval functions.
create or replace function private.classify_notification_event()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.event_type = 'general' then
    new.event_type := case
      when new.entity_type = 'payment_proof' and new.title = 'New payment proof'
        then 'payment_proof_submitted'
      when new.entity_type = 'payment_proof'
        then 'payment_review_result'
      else 'general'
    end;
  end if;
  return new;
end;
$$;

revoke all on function private.classify_notification_event()
  from public, anon, authenticated;

create trigger notifications_classify_event
before insert on public.notifications
for each row execute function private.classify_notification_event();

create or replace function private.notify_order_wallet_shortfall()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_profile_id uuid;
begin
  if coalesce(new.wallet_uncovered_cny, 0) <= 0 then
    return new;
  end if;

  select c.profile_id into v_client_profile_id
  from public.clients c
  where c.id = new.client_id;

  if v_client_profile_id is not null then
    insert into public.notifications (
      profile_id, title, body, event_type, entity_type, entity_id
    ) values (
      v_client_profile_id,
      'Wallet payment still required',
      format('This order has CNY %s not covered by wallet funds.', trim(to_char(new.wallet_uncovered_cny, 'FM999999999990.00'))),
      'wallet_insufficient',
      'order_item',
      new.id
    );
  end if;

  insert into public.notifications (
    profile_id, title, body, event_type, entity_type, entity_id
  )
  select
    p.id,
    'Order has uncovered wallet cost',
    format('Order %s has CNY %s awaiting payment.', new.id, trim(to_char(new.wallet_uncovered_cny, 'FM999999999990.00'))),
    'wallet_insufficient',
    'order_item',
    new.id
  from public.profiles p
  where p.role in ('admin', 'super_admin')
    and p.status = 'active';

  return new;
end;
$$;

revoke all on function private.notify_order_wallet_shortfall()
  from public, anon, authenticated;

create trigger order_items_notify_wallet_shortfall
after insert on public.order_items
for each row
when (new.wallet_uncovered_cny > 0)
execute function private.notify_order_wallet_shortfall();

create or replace function private.notify_wallet_ledger_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_profile_id uuid;
  v_title text;
  v_body text;
  v_event_type text;
begin
  if new.status <> 'posted'
     or (new.transaction_type <> 'reservation_release'
         and new.transaction_type <> 'adjustment') then
    return new;
  end if;

  select c.profile_id into v_client_profile_id
  from public.clients c
  where c.id = new.client_id;

  if v_client_profile_id is null then
    return new;
  end if;

  if new.transaction_type = 'reservation_release' then
    v_title := 'Wallet reservation released';
    v_body := format('CNY %s is available again after an order reservation was released.', trim(to_char(abs(new.amount_cny), 'FM999999999990.00')));
    v_event_type := 'reservation_released';
  else
    v_title := 'Wallet balance corrected';
    v_body := format('A CNY %s wallet adjustment was posted. Reason: %s', trim(to_char(new.amount_cny, 'FM999999999990.00')), coalesce(new.notes, 'Administrative correction'));
    v_event_type := 'wallet_corrected';
  end if;

  insert into public.notifications (
    profile_id, title, body, event_type, entity_type, entity_id
  ) values (
    v_client_profile_id, v_title, v_body, v_event_type,
    'wallet_transaction', new.id
  );

  return new;
end;
$$;

revoke all on function private.notify_wallet_ledger_event()
  from public, anon, authenticated;

create trigger wallet_transactions_notify_ledger_event
after insert on public.wallet_transactions
for each row execute function private.notify_wallet_ledger_event();

create or replace function private.get_admin_financial_dashboard_internal()
returns table (
  pending_payment_proofs bigint,
  needs_review_payment_proofs bigint,
  client_count bigint,
  clients_with_balance bigint,
  total_client_funds_cny numeric(16,2),
  total_reserved_cny numeric(16,2),
  total_available_cny numeric(16,2),
  uncovered_order_count bigint,
  uncovered_order_cny numeric(16,2)
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.current_user_role() not in ('admin', 'super_admin')
     or not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.status = 'active'
     ) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  return query
  with wallet_by_client as (
    select
      c.id,
      coalesce(sum(wt.amount_cny) filter (
        where wt.status = 'posted'
          and wt.transaction_type not in ('reservation', 'reservation_release')
      ), 0)::numeric(16,2) as total_funds,
      greatest(-coalesce(sum(wt.amount_cny) filter (
        where wt.status = 'posted'
          and wt.transaction_type in ('reservation', 'reservation_release')
      ), 0), 0)::numeric(16,2) as reserved,
      coalesce(sum(wt.amount_cny) filter (
        where wt.status = 'posted'
      ), 0)::numeric(16,2) as available
    from public.clients c
    left join public.wallet_transactions wt on wt.client_id = c.id
    group by c.id
  ), wallet_summary as (
    select
      count(*)::bigint as client_count,
      count(*) filter (where total_funds <> 0 or reserved <> 0)::bigint as clients_with_balance,
      coalesce(sum(total_funds), 0)::numeric(16,2) as total_funds,
      coalesce(sum(reserved), 0)::numeric(16,2) as reserved,
      coalesce(sum(available), 0)::numeric(16,2) as available
    from wallet_by_client
  ), uncovered_summary as (
    select
      count(*) filter (where oi.wallet_uncovered_cny > 0)::bigint as order_count,
      coalesce(sum(oi.wallet_uncovered_cny) filter (where oi.wallet_uncovered_cny > 0), 0)::numeric(16,2) as amount
    from public.order_items oi
    where oi.status::text not in ('cancelled', 'completed', 'rejected')
  )
  select
    (select count(*) from public.payment_proofs pp where pp.status = 'pending')::bigint,
    (select count(*) from public.payment_proofs pp where pp.status = 'needs_review')::bigint,
    ws.client_count,
    ws.clients_with_balance,
    ws.total_funds,
    ws.reserved,
    ws.available,
    us.order_count,
    us.amount
  from wallet_summary ws cross join uncovered_summary us;
end;
$$;

revoke all on function private.get_admin_financial_dashboard_internal()
  from public, anon, service_role;
grant execute on function private.get_admin_financial_dashboard_internal()
  to authenticated;

create or replace function public.get_admin_financial_dashboard()
returns table (
  pending_payment_proofs bigint,
  needs_review_payment_proofs bigint,
  client_count bigint,
  clients_with_balance bigint,
  total_client_funds_cny numeric(16,2),
  total_reserved_cny numeric(16,2),
  total_available_cny numeric(16,2),
  uncovered_order_count bigint,
  uncovered_order_cny numeric(16,2)
)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_admin_financial_dashboard_internal()
$$;

revoke all on function public.get_admin_financial_dashboard()
  from public, anon, service_role;
grant execute on function public.get_admin_financial_dashboard()
  to authenticated;

create or replace function private.get_wallet_reconciliation_internal()
returns table (
  negative_available_wallets bigint,
  approved_proofs_without_one_credit bigint,
  overcorrected_transactions bigint,
  invalid_order_coverage bigint
)
language plpgsql
security definer
stable
set search_path = ''
as $$
begin
  if auth.uid() is null
     or public.current_user_role() not in ('admin', 'super_admin')
     or not exists (
       select 1 from public.profiles p
       where p.id = auth.uid() and p.status = 'active'
     ) then
    raise exception using errcode = '42501', message = 'admin access required';
  end if;

  return query
  with wallet_balances as (
    select wt.client_id, sum(wt.amount_cny) as available
    from public.wallet_transactions wt
    where wt.status = 'posted'
    group by wt.client_id
  ), proof_credits as (
    select pp.id, count(wt.id) as credit_count
    from public.payment_proofs pp
    left join public.wallet_transactions wt
      on wt.payment_proof_id = pp.id
     and wt.transaction_type = 'advance_credit'
     and wt.status = 'posted'
    where pp.status = 'approved'
    group by pp.id
  ), corrections as (
    select source.id,
      coalesce(sum(abs(correction.amount_cny)), 0) as corrected,
      abs(source.amount_cny) as original
    from public.wallet_transactions source
    left join public.wallet_transactions correction
      on correction.corrects_transaction_id = source.id
     and correction.status = 'posted'
    where source.corrects_transaction_id is null
    group by source.id, source.amount_cny
  )
  select
    (select count(*) from wallet_balances where available < 0)::bigint,
    (select count(*) from proof_credits where credit_count <> 1)::bigint,
    (select count(*) from corrections where corrected > original)::bigint,
    (select count(*) from public.order_items oi
      where round(coalesce(oi.wallet_reserved_cny, 0) + coalesce(oi.wallet_uncovered_cny, 0), 2)
         <> round(coalesce(oi.wallet_required_cny, oi.wallet_reserved_cny + oi.wallet_uncovered_cny, 0), 2))::bigint;
end;
$$;

revoke all on function private.get_wallet_reconciliation_internal()
  from public, anon, service_role;
grant execute on function private.get_wallet_reconciliation_internal()
  to authenticated;

create or replace function public.get_wallet_reconciliation()
returns table (
  negative_available_wallets bigint,
  approved_proofs_without_one_credit bigint,
  overcorrected_transactions bigint,
  invalid_order_coverage bigint
)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_wallet_reconciliation_internal()
$$;

revoke all on function public.get_wallet_reconciliation()
  from public, anon, service_role;
grant execute on function public.get_wallet_reconciliation()
  to authenticated;
