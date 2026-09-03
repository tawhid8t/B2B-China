begin;

create or replace function private.get_wallet_statement_internal(
  p_client_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 30,
  p_transaction_type text default null,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  transaction_id uuid,
  client_id uuid,
  transaction_type public.wallet_transaction_type,
  amount_cny numeric(14,2),
  amount_bdt numeric(14,2),
  cny_to_bdt_rate numeric(10,4),
  running_available_balance_cny numeric(14,2),
  transaction_status public.wallet_transaction_status,
  payment_proof_id uuid,
  payment_proof_status public.payment_status,
  payment_claimed_bdt numeric(14,2),
  payment_approved_bdt numeric(14,2),
  order_item_id uuid,
  product_link_id uuid,
  product_title text,
  corrects_transaction_id uuid,
  cumulative_corrected_cny numeric(14,2),
  correction_remaining_cny numeric(14,2),
  actor_id uuid,
  actor_name text,
  reason text,
  created_at timestamptz,
  total_funds_cny numeric(14,2),
  active_reserved_cny numeric(14,2),
  available_balance_cny numeric(14,2),
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_client_id uuid;
  v_total_funds numeric(14,2);
  v_reserved numeric(14,2);
  v_available numeric(14,2);
begin
  select p.role into v_role
  from public.profiles p
  where p.id = v_actor and p.status = 'active';

  if v_actor is null or v_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'wallet statement access denied';
  end if;
  if p_page is null or p_page < 1 or p_page_size is null or p_page_size < 1 or p_page_size > 5000 then
    raise exception using errcode = '22023', message = 'invalid wallet statement pagination';
  end if;
  if p_from_date is not null and p_to_date is not null and p_from_date > p_to_date then
    raise exception using errcode = '22023', message = 'wallet statement date range is invalid';
  end if;
  if p_transaction_type is not null and not exists (
    select 1 from pg_catalog.pg_enum e
    join pg_catalog.pg_type t on t.oid = e.enumtypid
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'wallet_transaction_type'
      and e.enumlabel = p_transaction_type
  ) then
    raise exception using errcode = '22023', message = 'wallet transaction type is invalid';
  end if;

  if v_role = 'client' then
    select c.id into v_client_id from public.clients c where c.profile_id = v_actor;
    if v_client_id is null then
      raise exception using errcode = 'P0002', message = 'client profile not found';
    end if;
    if p_client_id is not null and p_client_id <> v_client_id then
      raise exception using errcode = '42501', message = 'wallet statement access denied';
    end if;
  else
    if p_client_id is null then
      raise exception using errcode = '22023', message = 'client id is required for an admin wallet statement';
    end if;
    v_client_id := p_client_id;
  end if;

  if not exists (select 1 from public.clients c where c.id = v_client_id) then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  select
    coalesce(sum(wt.amount_cny) filter (
      where wt.status = 'posted' and wt.transaction_type not in ('reservation', 'reservation_release')
    ), 0),
    greatest(-coalesce(sum(wt.amount_cny) filter (
      where wt.status = 'posted' and wt.transaction_type in ('reservation', 'reservation_release')
    ), 0), 0),
    coalesce(sum(wt.amount_cny) filter (where wt.status = 'posted'), 0)
  into v_total_funds, v_reserved, v_available
  from public.wallet_transactions wt where wt.client_id = v_client_id;

  return query
  with filtered as (
    select wt.*
    from public.wallet_transactions wt
    where wt.client_id = v_client_id
      and (p_transaction_type is null or wt.transaction_type::text = p_transaction_type)
      and (p_from_date is null or wt.created_at >= p_from_date::timestamptz)
      and (p_to_date is null or wt.created_at < (p_to_date + 1)::timestamptz)
  ), statement_rows as (
    select
      wt.*,
      count(*) over() as matched_count,
      coalesce((select sum(abs(correction.amount_cny))
        from public.wallet_transactions correction
        where correction.corrects_transaction_id = wt.id
          and correction.status = 'posted'), 0)::numeric(14,2) as corrected_cny
    from filtered wt
  )
  select
    wt.id, wt.client_id, wt.transaction_type, wt.amount_cny, wt.amount_bdt,
    wt.cny_to_bdt_rate, wt.running_balance_cny, wt.status,
    wt.payment_proof_id, pp.status, pp.amount_bdt, pp.approved_amount_bdt,
    wt.order_item_id, wt.product_link_id, pl.title, wt.corrects_transaction_id,
    wt.corrected_cny,
    case
      when wt.corrects_transaction_id is null
        and wt.transaction_type not in ('reservation', 'reservation_release')
      then greatest(abs(wt.amount_cny) - wt.corrected_cny, 0)::numeric(14,2)
      else null::numeric(14,2)
    end,
    coalesce(wt.created_by, wt.approved_by),
    coalesce(actor.full_name, actor.email), wt.notes, wt.created_at,
    v_total_funds, v_reserved, v_available, wt.matched_count
  from statement_rows wt
  left join public.payment_proofs pp on pp.id = wt.payment_proof_id
  left join public.product_links pl on pl.id = wt.product_link_id
  left join public.profiles actor on actor.id = coalesce(wt.created_by, wt.approved_by)
  order by wt.created_at desc, wt.id desc
  limit p_page_size offset ((p_page - 1) * p_page_size);
end;
$$;

revoke all on function private.get_wallet_statement_internal(uuid, integer, integer, text, date, date)
  from public, anon;
grant execute on function private.get_wallet_statement_internal(uuid, integer, integer, text, date, date)
  to authenticated;

create or replace function public.get_wallet_statement(
  p_client_id uuid default null,
  p_page integer default 1,
  p_page_size integer default 30,
  p_transaction_type text default null,
  p_from_date date default null,
  p_to_date date default null
)
returns table (
  transaction_id uuid,
  client_id uuid,
  transaction_type public.wallet_transaction_type,
  amount_cny numeric(14,2),
  amount_bdt numeric(14,2),
  cny_to_bdt_rate numeric(10,4),
  running_available_balance_cny numeric(14,2),
  transaction_status public.wallet_transaction_status,
  payment_proof_id uuid,
  payment_proof_status public.payment_status,
  payment_claimed_bdt numeric(14,2),
  payment_approved_bdt numeric(14,2),
  order_item_id uuid,
  product_link_id uuid,
  product_title text,
  corrects_transaction_id uuid,
  cumulative_corrected_cny numeric(14,2),
  correction_remaining_cny numeric(14,2),
  actor_id uuid,
  actor_name text,
  reason text,
  created_at timestamptz,
  total_funds_cny numeric(14,2),
  active_reserved_cny numeric(14,2),
  available_balance_cny numeric(14,2),
  total_count bigint
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.get_wallet_statement_internal(
    p_client_id, p_page, p_page_size, p_transaction_type,
    p_from_date, p_to_date
  );
$$;

revoke all on function public.get_wallet_statement(uuid, integer, integer, text, date, date)
  from public, anon, service_role;
grant execute on function public.get_wallet_statement(uuid, integer, integer, text, date, date)
  to authenticated;

create or replace function private.create_wallet_adjustment_internal(
  p_client_id uuid,
  p_amount_cny numeric,
  p_cny_to_bdt_rate numeric,
  p_reason text
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_amount_cny numeric(14,2) := round(p_amount_cny, 2);
  v_rate numeric(10,4) := round(p_cny_to_bdt_rate, 4);
  v_amount_bdt numeric(14,2);
  v_available numeric(14,2);
  v_transaction public.wallet_transactions%rowtype;
begin
  select p.role into v_role from public.profiles p
  where p.id = v_actor and p.status = 'active';
  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if v_amount_cny is null or v_amount_cny = 0 then
    raise exception using errcode = '22023', message = 'non-zero CNY adjustment amount is required';
  end if;
  if v_rate is null or v_rate <= 0 then
    raise exception using errcode = '22023', message = 'positive exchange rate required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'adjustment reason is required';
  end if;
  v_amount_bdt := round(v_amount_cny * v_rate, 2);
  if v_amount_bdt = 0 then
    raise exception using errcode = '22023', message = 'adjustment amount is too small at this exchange rate';
  end if;

  perform 1 from public.clients c where c.id = p_client_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'client not found'; end if;
  select coalesce(sum(wt.amount_cny), 0)::numeric(14,2) into v_available
  from public.wallet_transactions wt
  where wt.client_id = p_client_id and wt.status = 'posted';
  if v_available + v_amount_cny < 0 then
    raise exception using errcode = '23514', message = 'adjustment would make available wallet balance negative';
  end if;

  perform set_config('app.audit_reason', btrim(p_reason), true);
  v_transaction := private.post_wallet_transaction_internal(
    p_client_id, 'adjustment'::public.wallet_transaction_type,
    v_amount_bdt, v_amount_cny, v_rate,
    null, null, null, null, btrim(p_reason), null
  );
  perform set_config('app.audit_reason', '', true);
  return v_transaction;
end;
$$;

revoke all on function private.create_wallet_adjustment_internal(uuid, numeric, numeric, text)
  from public, anon;
grant execute on function private.create_wallet_adjustment_internal(uuid, numeric, numeric, text)
  to authenticated;

create or replace function public.create_wallet_adjustment(
  p_client_id uuid,
  p_amount_cny numeric,
  p_cny_to_bdt_rate numeric,
  p_reason text
)
returns public.wallet_transactions
language sql
security invoker
set search_path = ''
as $$
  select private.create_wallet_adjustment_internal(
    p_client_id, p_amount_cny, p_cny_to_bdt_rate, p_reason
  );
$$;

revoke all on function public.create_wallet_adjustment(uuid, numeric, numeric, text)
  from public, anon, service_role;
grant execute on function public.create_wallet_adjustment(uuid, numeric, numeric, text)
  to authenticated;

create or replace function private.correct_wallet_transaction_internal(
  p_transaction_id uuid,
  p_amount_cny numeric,
  p_reason text
)
returns public.wallet_transactions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_original public.wallet_transactions%rowtype;
  v_transaction public.wallet_transactions%rowtype;
  v_requested_cny numeric(14,2) := round(abs(p_amount_cny), 2);
  v_existing_cny numeric(14,2);
  v_existing_bdt numeric(14,2);
  v_remaining_cny numeric(14,2);
  v_remaining_bdt numeric(14,2);
  v_amount_cny numeric(14,2);
  v_amount_bdt numeric(14,2);
  v_available numeric(14,2);
  v_running numeric(14,2);
  v_type public.wallet_transaction_type;
begin
  select p.role into v_role from public.profiles p
  where p.id = v_actor and p.status = 'active';
  if v_actor is null or v_role not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if v_requested_cny is null or v_requested_cny <= 0 then
    raise exception using errcode = '22023', message = 'positive correction amount is required';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'correction reason is required';
  end if;

  select wt.* into v_original from public.wallet_transactions wt
  where wt.id = p_transaction_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'wallet transaction not found'; end if;
  if v_original.status <> 'posted'::public.wallet_transaction_status
     or v_original.transaction_type in ('reservation', 'reservation_release')
     or v_original.corrects_transaction_id is not null then
    raise exception using errcode = '23514', message = 'only a posted base financial transaction can be corrected';
  end if;
  if v_original.amount_cny = 0 or v_original.amount_bdt = 0 then
    raise exception using errcode = '23514', message = 'legacy zero-value currency entries require offline reconciliation';
  end if;

  perform 1 from public.clients c where c.id = v_original.client_id for update;
  select
    coalesce(sum(abs(wt.amount_cny)), 0),
    coalesce(sum(abs(wt.amount_bdt)), 0)
  into v_existing_cny, v_existing_bdt
  from public.wallet_transactions wt
  where wt.corrects_transaction_id = v_original.id and wt.status = 'posted';
  v_remaining_cny := abs(v_original.amount_cny) - v_existing_cny;
  v_remaining_bdt := abs(v_original.amount_bdt) - v_existing_bdt;
  if v_requested_cny > v_remaining_cny then
    raise exception using errcode = '23514', message = 'wallet correction exceeds the uncorrected original amount';
  end if;

  if v_requested_cny = v_remaining_cny then
    v_amount_bdt := v_remaining_bdt;
  else
    v_amount_bdt := least(
      round(abs(v_original.amount_bdt) * (v_requested_cny / abs(v_original.amount_cny)), 2),
      v_remaining_bdt
    );
  end if;
  if v_amount_bdt <= 0 then
    raise exception using errcode = '23514', message = 'correction BDT amount is exhausted';
  end if;

  if v_original.amount_cny > 0 then
    v_amount_cny := -v_requested_cny;
    v_amount_bdt := -v_amount_bdt;
    v_type := 'adjustment'::public.wallet_transaction_type;
  else
    v_amount_cny := v_requested_cny;
    v_type := 'refund'::public.wallet_transaction_type;
  end if;

  select coalesce(sum(wt.amount_cny), 0)::numeric(14,2) into v_available
  from public.wallet_transactions wt
  where wt.client_id = v_original.client_id and wt.status = 'posted';
  v_running := v_available + v_amount_cny;
  if v_running < 0 then
    raise exception using errcode = '23514', message = 'correction would make available wallet balance negative';
  end if;

  perform set_config('app.audit_reason', btrim(p_reason), true);
  insert into public.wallet_transactions (
    client_id, transaction_type, amount_bdt, amount_cny, cny_to_bdt_rate,
    running_balance_cny, proof_file_path, status, notes, approved_by,
    payment_proof_id, order_item_id, order_group_id, product_link_id,
    created_by, corrects_transaction_id
  ) values (
    v_original.client_id, v_type, v_amount_bdt, v_amount_cny,
    v_original.cny_to_bdt_rate, v_running, v_original.proof_file_path,
    'posted', btrim(p_reason), v_actor, v_original.payment_proof_id,
    v_original.order_item_id, v_original.order_group_id,
    v_original.product_link_id, v_actor, v_original.id
  ) returning * into v_transaction;
  perform set_config('app.audit_reason', '', true);
  return v_transaction;
end;
$$;

revoke all on function private.correct_wallet_transaction_internal(uuid, numeric, text)
  from public, anon;
grant execute on function private.correct_wallet_transaction_internal(uuid, numeric, text)
  to authenticated;

create or replace function public.correct_wallet_transaction(
  p_transaction_id uuid,
  p_amount_cny numeric,
  p_reason text
)
returns public.wallet_transactions
language sql
security invoker
set search_path = ''
as $$
  select private.correct_wallet_transaction_internal(
    p_transaction_id, p_amount_cny, p_reason
  );
$$;

revoke all on function public.correct_wallet_transaction(uuid, numeric, text)
  from public, anon, service_role;
grant execute on function public.correct_wallet_transaction(uuid, numeric, text)
  to authenticated;

commit;
