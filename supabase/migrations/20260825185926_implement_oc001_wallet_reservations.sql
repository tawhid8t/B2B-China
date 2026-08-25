-- OC-001: reserve available wallet credit at estimate acceptance, then convert
-- the reservation to a debit only when purchasing is committed.

begin;

alter table public.wallet_transactions
  add column reservation_transaction_id uuid
    references public.wallet_transactions(id) on delete restrict;

alter table public.order_items
  add column wallet_reserved_cny numeric(14,2) not null default 0,
  add column wallet_uncovered_cny numeric(14,2) not null default 0,
  add constraint order_items_wallet_reserved_nonnegative
    check (wallet_reserved_cny >= 0),
  add constraint order_items_wallet_uncovered_nonnegative
    check (wallet_uncovered_cny >= 0);

comment on column public.wallet_transactions.reservation_transaction_id is
  'Links an append-only reservation release or committed debit to its original reservation.';
comment on column public.order_items.wallet_reserved_cny is
  'Historical amount reserved when the estimate was accepted.';
comment on column public.order_items.wallet_uncovered_cny is
  'Estimated or committed CNY amount not covered by wallet credit.';

create unique index wallet_transactions_one_reservation_per_order_idx
on public.wallet_transactions (order_item_id)
where transaction_type = 'reservation'
  and order_item_id is not null;

create unique index wallet_transactions_one_release_per_reservation_idx
on public.wallet_transactions (reservation_transaction_id)
where transaction_type = 'reservation_release'
  and reservation_transaction_id is not null;

create unique index wallet_transactions_one_debit_per_reservation_idx
on public.wallet_transactions (reservation_transaction_id)
where transaction_type = 'order_debit'
  and reservation_transaction_id is not null;

create unique index provider_orders_provider_reference_key
on public.provider_orders (provider, provider_order_id)
where provider_order_id is not null;

create or replace function private.validate_wallet_reservation_link()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_reservation public.wallet_transactions%rowtype;
begin
  if new.transaction_type = 'reservation' then
    if new.order_item_id is null or new.reservation_transaction_id is not null then
      raise exception using
        errcode = '23514',
        message = 'reservation requires an order item and cannot link another reservation';
    end if;
    return new;
  end if;

  if new.transaction_type = 'reservation_release'
     and new.reservation_transaction_id is null then
    raise exception using errcode = '23514', message = 'reservation release must link its reservation';
  end if;

  if new.reservation_transaction_id is null then
    return new;
  end if;

  select *
  into v_reservation
  from public.wallet_transactions wt
  where wt.id = new.reservation_transaction_id;

  if not found or v_reservation.transaction_type <> 'reservation' then
    raise exception using errcode = '23514', message = 'wallet transaction must link a reservation';
  end if;

  if new.transaction_type not in ('reservation_release', 'order_debit')
     or new.client_id <> v_reservation.client_id
     or new.order_item_id is distinct from v_reservation.order_item_id then
    raise exception using errcode = '23514', message = 'reservation link does not match wallet transaction';
  end if;

  if new.transaction_type = 'reservation_release'
     and (
       new.amount_cny <> -v_reservation.amount_cny
       or new.amount_bdt <> -v_reservation.amount_bdt
     ) then
    raise exception using errcode = '23514', message = 'reservation release must exactly offset its reservation';
  end if;

  if new.transaction_type = 'order_debit'
     and abs(new.amount_cny) > abs(v_reservation.amount_cny) then
    raise exception using errcode = '23514', message = 'wallet debit cannot exceed its reservation';
  end if;

  return new;
end;
$$;

revoke all on function private.validate_wallet_reservation_link()
  from public, anon, authenticated;

create trigger wallet_transactions_validate_reservation_link
before insert on public.wallet_transactions
for each row execute function private.validate_wallet_reservation_link();

create or replace function private.protect_posted_wallet_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'wallet transactions are append-only; cancel pending entries or create an adjustment row'
      using errcode = '55000';
  end if;

  if old.status <> 'pending'::public.wallet_transaction_status then
    raise exception 'finalized wallet transactions are immutable; create an adjustment row'
      using errcode = '55000';
  end if;

  if new.status not in (
    'posted'::public.wallet_transaction_status,
    'cancelled'::public.wallet_transaction_status
  ) then
    raise exception 'pending wallet transactions may only be posted or cancelled'
      using errcode = '23514';
  end if;

  if row(
    new.client_id,
    new.transaction_type,
    new.amount_bdt,
    new.amount_cny,
    new.cny_to_bdt_rate,
    new.running_balance_cny,
    new.payment_proof_id,
    new.order_item_id,
    new.order_group_id,
    new.product_link_id,
    new.reservation_transaction_id
  ) is distinct from row(
    old.client_id,
    old.transaction_type,
    old.amount_bdt,
    old.amount_cny,
    old.cny_to_bdt_rate,
    old.running_balance_cny,
    old.payment_proof_id,
    old.order_item_id,
    old.order_group_id,
    old.product_link_id,
    old.reservation_transaction_id
  ) then
    raise exception 'wallet financial fields are immutable; cancel and create a corrected entry'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function private.post_wallet_transaction_internal(
  p_client_id uuid,
  p_transaction_type public.wallet_transaction_type,
  p_amount_bdt numeric,
  p_amount_cny numeric,
  p_cny_to_bdt_rate numeric,
  p_payment_proof_id uuid default null,
  p_order_item_id uuid default null,
  p_order_group_id uuid default null,
  p_product_link_id uuid default null,
  p_notes text default null,
  p_reservation_transaction_id uuid default null
)
returns public.wallet_transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_previous_balance numeric(14,2);
  v_running_balance numeric(14,2);
  v_transaction public.wallet_transactions%rowtype;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
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

  if p_transaction_type in ('advance_credit', 'refund', 'reservation_release')
     and (p_amount_bdt <= 0 or p_amount_cny <= 0) then
    raise exception using errcode = '22023', message = 'credit amounts must be positive';
  end if;

  if p_transaction_type in ('order_debit', 'reservation')
     and (p_amount_bdt >= 0 or p_amount_cny >= 0) then
    raise exception using errcode = '22023', message = 'debit and reservation amounts must be negative';
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

  if p_transaction_type in ('order_debit', 'reservation') and p_order_item_id is null then
    raise exception using errcode = '22023', message = 'order item is required for wallet debit or reservation';
  end if;

  perform 1
  from public.clients c
  where c.id = p_client_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  select coalesce(sum(wt.amount_cny), 0)::numeric(14,2)
  into v_previous_balance
  from public.wallet_transactions wt
  where wt.client_id = p_client_id
    and wt.status = 'posted';

  v_running_balance := (v_previous_balance + p_amount_cny)::numeric(14,2);

  if p_transaction_type in ('order_debit', 'reservation') and v_running_balance < 0 then
    raise exception using errcode = '23514', message = 'wallet transaction exceeds available balance';
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
    reservation_transaction_id,
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
    p_reservation_transaction_id,
    nullif(btrim(p_notes), ''),
    v_actor,
    v_actor
  )
  returning * into v_transaction;

  return v_transaction;
end;
$$;

revoke all on function private.post_wallet_transaction_internal(
  uuid, public.wallet_transaction_type, numeric, numeric, numeric,
  uuid, uuid, uuid, uuid, text, uuid
) from public, anon;
grant execute on function private.post_wallet_transaction_internal(
  uuid, public.wallet_transaction_type, numeric, numeric, numeric,
  uuid, uuid, uuid, uuid, text, uuid
) to authenticated, service_role;

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
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  return private.post_wallet_transaction_internal(
    p_client_id,
    p_transaction_type,
    p_amount_bdt,
    p_amount_cny,
    p_cny_to_bdt_rate,
    p_payment_proof_id,
    p_order_item_id,
    p_order_group_id,
    p_product_link_id,
    p_notes,
    null
  );
end;
$$;

create or replace function private.release_wallet_reservation_internal(
  p_order_item_id uuid,
  p_reason text
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
  v_order public.order_items%rowtype;
  v_reservation public.wallet_transactions%rowtype;
  v_release public.wallet_transactions%rowtype;
begin
  select oi.client_id
  into v_client_id
  from public.order_items oi
  where oi.id = p_order_item_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order item not found';
  end if;

  perform 1 from public.clients c where c.id = v_client_id for update;

  select *
  into v_order
  from public.order_items oi
  where oi.id = p_order_item_id
  for update;

  select *
  into v_reservation
  from public.wallet_transactions wt
  where wt.order_item_id = p_order_item_id
    and wt.transaction_type = 'reservation'
    and wt.status = 'posted'
  for update;

  if not found then
    return null;
  end if;

  select *
  into v_release
  from public.wallet_transactions wt
  where wt.reservation_transaction_id = v_reservation.id
    and wt.transaction_type = 'reservation_release'
    and wt.status = 'posted';

  if found then
    return v_release;
  end if;

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.reservation_transaction_id = v_reservation.id
      and wt.transaction_type = 'order_debit'
      and wt.status = 'posted'
  ) then
    raise exception using errcode = '23514', message = 'committed wallet reservation cannot be released';
  end if;

  v_release := private.post_wallet_transaction_internal(
    v_order.client_id,
    'reservation_release',
    -v_reservation.amount_bdt,
    -v_reservation.amount_cny,
    v_reservation.cny_to_bdt_rate,
    null,
    v_order.id,
    v_order.group_id,
    v_order.product_link_id,
    coalesce(nullif(btrim(p_reason), ''), 'wallet reservation released'),
    v_reservation.id
  );

  return v_release;
end;
$$;

revoke all on function private.release_wallet_reservation_internal(uuid, text)
  from public, anon, authenticated;

create or replace function public.release_wallet_reservation(
  p_order_item_id uuid,
  p_reason text
)
returns public.wallet_transactions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_role public.user_role;
begin
  v_role := public.current_user_role();

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1
       from public.order_items oi
       join public.clients c on c.id = oi.client_id
       where oi.id = p_order_item_id
         and oi.status = 'pending_admin_review'
         and c.profile_id = auth.uid()
     ) then
    raise exception using errcode = '42501', message = 'order reservation access denied';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'reservation release reason is required';
  end if;

  return private.release_wallet_reservation_internal(p_order_item_id, p_reason);
end;
$$;

revoke all on function public.release_wallet_reservation(uuid, text) from public, anon;
grant execute on function public.release_wallet_reservation(uuid, text)
  to authenticated, service_role;

create or replace function private.accept_estimate_with_reservation_internal(
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
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_estimate public.estimates%rowtype;
  v_order public.order_items%rowtype;
  v_group public.order_groups%rowtype;
  v_reservation public.wallet_transactions%rowtype;
  v_category text;
  v_required numeric(14,2);
  v_available numeric(14,2);
  v_reserved numeric(14,2);
  v_uncovered numeric(14,2);
  v_before jsonb;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  select *
  into v_estimate
  from public.estimates e
  where e.id = p_estimate_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'estimate not found';
  end if;

  if v_estimate.client_id <> p_client_id then
    raise exception using errcode = '42501', message = 'estimate client does not match request';
  end if;

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1
       from public.clients c
       where c.id = p_client_id
         and c.profile_id = v_actor
     ) then
    raise exception using errcode = '42501', message = 'estimate access denied';
  end if;

  perform 1 from public.clients c where c.id = p_client_id for update;

  if v_estimate.status = 'converted_to_order' then
    select *
    into v_order
    from public.order_items oi
    where oi.estimate_id = p_estimate_id;

    if not found then
      raise exception using errcode = 'P0001', message = 'converted estimate is missing its order item';
    end if;

    select *
    into v_group
    from public.order_groups og
    where og.id = v_order.group_id;

    select *
    into v_reservation
    from public.wallet_transactions wt
    where wt.order_item_id = v_order.id
      and wt.transaction_type = 'reservation';

    select coalesce(sum(wt.amount_cny), 0)::numeric(14,2)
    into v_available
    from public.wallet_transactions wt
    where wt.client_id = p_client_id
      and wt.status = 'posted';

    return query select
      v_order.id,
      v_group.id,
      v_group.group_code,
      v_order.status,
      case
        when v_order.wallet_uncovered_cny = 0 then 'reserved'
        when v_order.wallet_reserved_cny > 0 then 'reserved_or_partial'
        else 'insufficient_balance'
      end,
      v_reservation.id,
      (v_order.wallet_reserved_cny + v_order.wallet_uncovered_cny)::numeric(14,2),
      v_order.wallet_reserved_cny,
      v_order.wallet_uncovered_cny,
      v_available;
    return;
  end if;

  if v_estimate.status <> 'sent_to_client' then
    raise exception using errcode = '23514', message = 'estimate is not available for acceptance';
  end if;

  if v_estimate.valid_until <= now() then
    raise exception using errcode = 'P0001', message = 'estimate has expired';
  end if;

  if v_estimate.exchange_rate_cny_to_bdt is null
     or v_estimate.exchange_rate_cny_to_bdt <= 0 then
    raise exception using errcode = '23514', message = 'estimate is missing its exchange-rate snapshot';
  end if;

  v_required := round(v_estimate.total_bdt / v_estimate.exchange_rate_cny_to_bdt, 2);

  select coalesce(sum(wt.amount_cny), 0)::numeric(14,2)
  into v_available
  from public.wallet_transactions wt
  where wt.client_id = p_client_id
    and wt.status = 'posted';

  v_reserved := greatest(least(v_available, v_required), 0)::numeric(14,2);
  v_uncovered := greatest(v_required - v_reserved, 0)::numeric(14,2);
  v_before := to_jsonb(v_estimate);

  update public.estimates
  set status = 'accepted'
  where id = p_estimate_id;

  v_group := private.create_or_get_active_order_group_internal(p_client_id);

  select pl.category into v_category
  from public.product_links pl
  where pl.id = v_estimate.product_link_id;

  insert into public.order_items (
    client_id,
    group_id,
    estimate_id,
    product_link_id,
    product_sku_id,
    sku_id,
    quantity,
    cny_price,
    domestic_delivery_cny,
    estimated_weight_kg,
    category,
    estimated_total_bdt,
    wallet_reserved_cny,
    wallet_uncovered_cny,
    status
  )
  values (
    v_estimate.client_id,
    v_group.id,
    v_estimate.id,
    v_estimate.product_link_id,
    v_estimate.product_sku_id,
    v_estimate.sku_id,
    v_estimate.quantity,
    v_estimate.unit_price_cny,
    v_estimate.domestic_delivery_cny,
    v_estimate.estimated_total_weight_kg,
    coalesce(v_category, 'default'),
    v_estimate.total_bdt,
    v_reserved,
    v_uncovered,
    'pending_admin_review'
  )
  returning * into v_order;

  if v_reserved > 0 then
    v_reservation := private.post_wallet_transaction_internal(
      v_estimate.client_id,
      'reservation',
      -round(v_reserved * v_estimate.exchange_rate_cny_to_bdt, 2),
      -v_reserved,
      v_estimate.exchange_rate_cny_to_bdt,
      null,
      v_order.id,
      v_group.id,
      v_estimate.product_link_id,
      'Reserved when estimate was accepted',
      null
    );
  end if;

  update public.estimates
  set status = 'converted_to_order'
  where id = p_estimate_id
  returning * into v_estimate;

  perform private.write_audit_log_internal(
    'estimate',
    v_estimate.id,
    'estimate_accepted_and_converted',
    v_before,
    to_jsonb(v_estimate),
    case when v_uncovered > 0 then 'accepted with insufficient wallet balance warning' else null end
  );

  return query select
    v_order.id,
    v_group.id,
    v_group.group_code,
    v_order.status,
    case
      when v_uncovered = 0 then 'reserved'
      when v_reserved > 0 then 'reserved_or_partial'
      else 'insufficient_balance'
    end,
    v_reservation.id,
    v_required,
    v_reserved,
    v_uncovered,
    (v_available - v_reserved)::numeric(14,2);
end;
$$;

revoke all on function private.accept_estimate_with_reservation_internal(uuid, uuid)
  from public, anon;
grant execute on function private.accept_estimate_with_reservation_internal(uuid, uuid)
  to authenticated, service_role;

create or replace function public.accept_estimate_with_reservation(
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
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.accept_estimate_with_reservation_internal(p_estimate_id, p_client_id);
$$;

revoke all on function public.accept_estimate_with_reservation(uuid, uuid)
  from public, anon;
grant execute on function public.accept_estimate_with_reservation(uuid, uuid)
  to authenticated, service_role;

create or replace function private.convert_wallet_reservation_to_order_debit_internal(
  p_order_item_id uuid,
  p_actual_paid_cny numeric,
  p_cny_to_bdt_rate numeric default null,
  p_reason text default null
)
returns table (
  reservation_transaction_id uuid,
  release_transaction_id uuid,
  debit_transaction_id uuid,
  reserved_amount_cny numeric(14,2),
  debited_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2),
  applied_rate numeric(10,4)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_client_id uuid;
  v_order public.order_items%rowtype;
  v_reservation public.wallet_transactions%rowtype;
  v_release public.wallet_transactions%rowtype;
  v_debit public.wallet_transactions%rowtype;
  v_rate numeric(10,4);
  v_reserved numeric(14,2);
  v_debited numeric(14,2);
  v_uncovered numeric(14,2);
begin
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  if p_actual_paid_cny is null or p_actual_paid_cny <= 0 then
    raise exception using errcode = '22023', message = 'positive actual paid CNY amount required';
  end if;

  select oi.client_id into v_client_id
  from public.order_items oi
  where oi.id = p_order_item_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order item not found';
  end if;

  perform 1 from public.clients c where c.id = v_client_id for update;

  select * into v_order
  from public.order_items oi
  where oi.id = p_order_item_id
  for update;

  v_rate := p_cny_to_bdt_rate;
  if v_rate is null then
    select e.exchange_rate_cny_to_bdt
    into v_rate
    from public.estimates e
    where e.id = v_order.estimate_id;
  end if;

  if v_rate is null or v_rate <= 0 then
    raise exception using errcode = '23514', message = 'purchase commitment requires a positive exchange rate';
  end if;

  select * into v_reservation
  from public.wallet_transactions wt
  where wt.order_item_id = p_order_item_id
    and wt.transaction_type = 'reservation'
    and wt.status = 'posted'
  for update;

  if not found then
    v_uncovered := round(p_actual_paid_cny, 2);
    update public.order_items
    set wallet_uncovered_cny = v_uncovered
    where id = p_order_item_id;

    return query select null::uuid, null::uuid, null::uuid,
      0::numeric(14,2), 0::numeric(14,2), v_uncovered, v_rate;
    return;
  end if;

  v_reserved := abs(v_reservation.amount_cny)::numeric(14,2);

  select * into v_debit
  from public.wallet_transactions wt
  where wt.reservation_transaction_id = v_reservation.id
    and wt.transaction_type = 'order_debit'
    and wt.status = 'posted';

  if found then
    select * into v_release
    from public.wallet_transactions wt
    where wt.reservation_transaction_id = v_reservation.id
      and wt.transaction_type = 'reservation_release'
      and wt.status = 'posted';

    return query select
      v_reservation.id,
      v_release.id,
      v_debit.id,
      v_reserved,
      abs(v_debit.amount_cny)::numeric(14,2),
      v_order.wallet_uncovered_cny,
      v_debit.cny_to_bdt_rate;
    return;
  end if;

  if exists (
    select 1
    from public.wallet_transactions wt
    where wt.reservation_transaction_id = v_reservation.id
      and wt.transaction_type = 'reservation_release'
      and wt.status = 'posted'
  ) then
    raise exception using errcode = '23514', message = 'wallet reservation was already released';
  end if;

  v_release := private.release_wallet_reservation_internal(
    p_order_item_id,
    coalesce(nullif(btrim(p_reason), ''), 'reservation converted at purchase commitment')
  );

  v_debited := least(v_reserved, round(p_actual_paid_cny, 2))::numeric(14,2);
  v_uncovered := greatest(round(p_actual_paid_cny, 2) - v_debited, 0)::numeric(14,2);

  if v_debited > 0 then
    v_debit := private.post_wallet_transaction_internal(
      v_order.client_id,
      'order_debit',
      -round(v_debited * v_rate, 2),
      -v_debited,
      v_rate,
      null,
      v_order.id,
      v_order.group_id,
      v_order.product_link_id,
      coalesce(nullif(btrim(p_reason), ''), 'wallet debit committed at provider purchase'),
      v_reservation.id
    );
  end if;

  update public.order_items
  set wallet_uncovered_cny = v_uncovered
  where id = p_order_item_id;

  return query select
    v_reservation.id,
    v_release.id,
    v_debit.id,
    v_reserved,
    v_debited,
    v_uncovered,
    v_rate;
end;
$$;

revoke all on function private.convert_wallet_reservation_to_order_debit_internal(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function private.convert_wallet_reservation_to_order_debit_internal(uuid, numeric, numeric, text)
  to authenticated, service_role;

create or replace function public.convert_wallet_reservation_to_order_debit(
  p_order_item_id uuid,
  p_actual_paid_cny numeric,
  p_cny_to_bdt_rate numeric default null,
  p_reason text default null
)
returns table (
  reservation_transaction_id uuid,
  release_transaction_id uuid,
  debit_transaction_id uuid,
  reserved_amount_cny numeric(14,2),
  debited_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2),
  applied_rate numeric(10,4)
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.convert_wallet_reservation_to_order_debit_internal(
    p_order_item_id,
    p_actual_paid_cny,
    p_cny_to_bdt_rate,
    p_reason
  );
$$;

revoke all on function public.convert_wallet_reservation_to_order_debit(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function public.convert_wallet_reservation_to_order_debit(uuid, numeric, numeric, text)
  to authenticated, service_role;

create or replace function private.sync_provider_order_and_commit_wallet_internal(
  p_order_item_id uuid,
  p_provider text,
  p_provider_order_id text,
  p_paid_amount_cny numeric,
  p_seller_tracking_number text,
  p_provider_status text,
  p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null
)
returns table (
  provider_order_record_id uuid,
  order_item_status public.order_status,
  synced_at timestamptz,
  reservation_transaction_id uuid,
  release_transaction_id uuid,
  debit_transaction_id uuid,
  debited_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2),
  applied_rate numeric(10,4)
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_order public.order_items%rowtype;
  v_provider_order public.provider_orders%rowtype;
  v_commit record;
  v_synced_at timestamptz := now();
  v_normalized_status public.provider_order_status;
begin
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  if nullif(btrim(p_provider), '') is null
     or nullif(btrim(p_provider_order_id), '') is null then
    raise exception using errcode = '22023', message = 'provider and provider order ID are required';
  end if;

  if p_paid_amount_cny is null or p_paid_amount_cny <= 0 then
    raise exception using errcode = '22023', message = 'positive paid amount is required';
  end if;

  select * into v_order
  from public.order_items oi
  where oi.id = p_order_item_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'order item not found';
  end if;

  if v_order.status not in ('queued_for_purchase', 'purchased', 'seller_shipped') then
    raise exception using errcode = '23514', message = 'order is not eligible for provider purchase sync';
  end if;

  v_normalized_status := case
    when p_provider_status in ('cancelled', 'refund_requested', 'refunded', 'exception')
      then p_provider_status::public.provider_order_status
    when p_provider_status in ('seller_shipped', 'shipped')
      or nullif(btrim(p_seller_tracking_number), '') is not null
      then 'seller_shipped'::public.provider_order_status
    else 'paid'::public.provider_order_status
  end;

  insert into public.provider_orders (
    order_item_id,
    provider,
    provider_order_id,
    paid_amount_cny,
    seller_tracking_number,
    provider_status,
    status,
    raw_payload,
    synced_at
  )
  values (
    p_order_item_id,
    btrim(p_provider),
    btrim(p_provider_order_id),
    p_paid_amount_cny,
    nullif(btrim(p_seller_tracking_number), ''),
    p_provider_status,
    v_normalized_status,
    coalesce(p_raw_payload, '{}'::jsonb),
    v_synced_at
  )
  on conflict (provider, provider_order_id) where provider_order_id is not null
  do update set
    paid_amount_cny = excluded.paid_amount_cny,
    seller_tracking_number = coalesce(excluded.seller_tracking_number, public.provider_orders.seller_tracking_number),
    provider_status = excluded.provider_status,
    status = excluded.status,
    raw_payload = excluded.raw_payload,
    synced_at = excluded.synced_at
  where public.provider_orders.order_item_id = excluded.order_item_id
  returning * into v_provider_order;

  if not found then
    raise exception using errcode = '23505', message = 'provider order reference belongs to another order item';
  end if;

  select * into v_commit
  from private.convert_wallet_reservation_to_order_debit_internal(
    p_order_item_id,
    p_paid_amount_cny,
    p_cny_to_bdt_rate,
    'provider order synced and purchase committed'
  );

  update public.order_items
  set actual_total_bdt = round(p_paid_amount_cny * v_commit.applied_rate, 2)
  where id = p_order_item_id;

  select * into v_order from public.order_items oi where oi.id = p_order_item_id;

  if v_order.status = 'queued_for_purchase' then
    v_order := private.change_order_status_internal(
      p_order_item_id,
      'purchased',
      'provider order and paid amount recorded'
    );
  end if;

  if v_order.status = 'purchased'
     and v_normalized_status = 'seller_shipped' then
    v_order := private.change_order_status_internal(
      p_order_item_id,
      'seller_shipped',
      'seller tracking recorded by provider sync'
    );
  end if;

  insert into public.integration_logs (
    provider,
    operation,
    request_payload,
    response_payload,
    status
  )
  values (
    btrim(p_provider),
    'provider_order_sync',
    jsonb_build_object(
      'orderItemId', p_order_item_id,
      'providerOrderId', p_provider_order_id,
      'paidAmountCny', p_paid_amount_cny,
      'providerStatus', p_provider_status
    ),
    jsonb_build_object(
      'providerOrderRecordId', v_provider_order.id,
      'orderStatus', v_order.status,
      'debitTransactionId', v_commit.debit_transaction_id,
      'uncoveredAmountCny', v_commit.uncovered_amount_cny
    ),
    'success'
  );

  return query select
    v_provider_order.id,
    v_order.status,
    v_synced_at,
    v_commit.reservation_transaction_id,
    v_commit.release_transaction_id,
    v_commit.debit_transaction_id,
    v_commit.debited_amount_cny,
    v_commit.uncovered_amount_cny,
    v_commit.applied_rate;
end;
$$;

revoke all on function private.sync_provider_order_and_commit_wallet_internal(
  uuid, text, text, numeric, text, text, jsonb, numeric
) from public, anon;
grant execute on function private.sync_provider_order_and_commit_wallet_internal(
  uuid, text, text, numeric, text, text, jsonb, numeric
) to authenticated, service_role;

create or replace function public.sync_provider_order_and_commit_wallet(
  p_order_item_id uuid,
  p_provider text,
  p_provider_order_id text,
  p_paid_amount_cny numeric,
  p_seller_tracking_number text,
  p_provider_status text,
  p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null
)
returns table (
  provider_order_record_id uuid,
  order_item_status public.order_status,
  synced_at timestamptz,
  reservation_transaction_id uuid,
  release_transaction_id uuid,
  debit_transaction_id uuid,
  debited_amount_cny numeric(14,2),
  uncovered_amount_cny numeric(14,2),
  applied_rate numeric(10,4)
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.sync_provider_order_and_commit_wallet_internal(
    p_order_item_id,
    p_provider,
    p_provider_order_id,
    p_paid_amount_cny,
    p_seller_tracking_number,
    p_provider_status,
    p_raw_payload,
    p_cny_to_bdt_rate
  );
$$;

revoke all on function public.sync_provider_order_and_commit_wallet(
  uuid, text, text, numeric, text, text, jsonb, numeric
) from public, anon;
grant execute on function public.sync_provider_order_and_commit_wallet(
  uuid, text, text, numeric, text, text, jsonb, numeric
) to authenticated, service_role;

create or replace function private.release_reservation_on_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.release_wallet_reservation_internal(
    new.id,
    coalesce(nullif(current_setting('app.order_status_reason', true), ''), 'order cancelled')
  );
  return new;
end;
$$;

revoke all on function private.release_reservation_on_order_cancellation()
  from public, anon, authenticated;

create trigger order_items_release_reservation_on_cancellation
after update of status on public.order_items
for each row
when (new.status = 'cancelled' and old.status is distinct from new.status)
execute function private.release_reservation_on_order_cancellation();

create or replace function private.release_reservation_on_estimate_rejection()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_item_id uuid;
begin
  select oi.id into v_order_item_id
  from public.order_items oi
  where oi.estimate_id = new.id;

  if found then
    perform private.release_wallet_reservation_internal(
      v_order_item_id,
      'estimate rejected or cancelled'
    );
  end if;

  return new;
end;
$$;

revoke all on function private.release_reservation_on_estimate_rejection()
  from public, anon, authenticated;

create trigger estimates_release_reservation_on_rejection
after update of status on public.estimates
for each row
when (
  new.status in ('rejected', 'cancelled')
  and old.status is distinct from new.status
)
execute function private.release_reservation_on_estimate_rejection();

commit;
