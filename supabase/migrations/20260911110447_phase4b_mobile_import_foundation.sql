-- Cainiao pickup codes are only available on the authenticated mobile
-- experience. This migration retires desktop/extension ingestion as a new
-- source, while preserving existing parcel and parcel_items relationships.

create table public.cainiao_import_batches (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('manual', 'screenshot')),
  created_by uuid not null references public.profiles(id) on delete restrict,
  input_count integer not null check (input_count between 1 and 200),
  inserted_count integer not null default 0 check (inserted_count >= 0),
  refreshed_count integer not null default 0 check (refreshed_count >= 0),
  matched_count integer not null default 0 check (matched_count >= 0),
  unmatched_count integer not null default 0 check (unmatched_count >= 0),
  screenshot_path text,
  diagnostics jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint cainiao_import_batches_diagnostics_size check (octet_length(diagnostics::text) <= 65536)
);

comment on table public.cainiao_import_batches is
  'Append-only operational batches for mobile Cainiao imports. Parcel source_payload remains compact per-parcel evidence.';

alter table public.cainiao_import_batches enable row level security;
revoke all on table public.cainiao_import_batches from public, anon, authenticated;

alter table public.parcels
  add column cainiao_import_batch_id uuid references public.cainiao_import_batches(id) on delete restrict,
  add column unmatched_review_status text not null default 'open'
    check (unmatched_review_status in ('open', 'linked', 'archived')),
  add column unmatched_reviewed_by uuid references public.profiles(id) on delete restrict,
  add column unmatched_reviewed_at timestamptz,
  add column unmatched_review_reason text,
  add constraint parcels_unmatched_review_pair check (
    (unmatched_review_status = 'open'
      and unmatched_reviewed_by is null
      and unmatched_reviewed_at is null
      and unmatched_review_reason is null)
    or (unmatched_review_status in ('linked', 'archived')
      and unmatched_reviewed_by is not null
      and unmatched_reviewed_at is not null
      and nullif(btrim(unmatched_review_reason), '') is not null)
  );

comment on column public.parcels.cainiao_import_batch_id is
  'Most recent mobile Cainiao import batch that refreshed this parcel; audit logs retain the full history.';
comment on column public.parcels.unmatched_review_status is
  'Operational review state only. A parcel is automatically matched only by tracking number.';

drop index if exists public.parcels_cainiao_collection_queue_idx;
create index parcels_cainiao_collection_queue_idx
  on public.parcels (status, source_synced_at desc)
  where source in ('manual', 'screenshot');
create index cainiao_import_batches_created_at_idx
  on public.cainiao_import_batches (created_at desc);
create index parcels_cainiao_import_batch_id_idx
  on public.parcels (cainiao_import_batch_id)
  where cainiao_import_batch_id is not null;

create or replace function public.sync_cainiao_parcels(
  p_parcels jsonb,
  p_source text default 'manual'
)
returns table (
  tracking_number text,
  parcel_id uuid,
  inserted boolean,
  matched_order_item_count integer,
  parcel_status public.parcel_status
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_item jsonb;
  v_tracking text;
  v_source text := lower(btrim(coalesce(p_source, '')));
  v_batch_id uuid := nullif(current_setting('app.cainiao_import_batch_id', true), '')::uuid;
  v_before jsonb;
  v_parcel public.parcels%rowtype;
  v_exists boolean;
  v_source_status text;
  v_next_status public.parcel_status;
  v_matched integer;
begin
  if v_actor is null or public.current_user_role() not in ('staff_receiver', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'receiving role required';
  end if;
  if v_source not in ('manual', 'screenshot') then
    raise exception using errcode = '22023', message = 'unsupported parcel source';
  end if;
  if jsonb_typeof(p_parcels) <> 'array' or jsonb_array_length(p_parcels) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'one to two hundred parcels are required';
  end if;
  if exists (
    select 1
    from jsonb_array_elements(p_parcels) value
    group by upper(regexp_replace(btrim(coalesce(value->>'trackingNumber', '')), '\\s+', '', 'g'))
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'duplicate tracking number in import batch';
  end if;

  for v_item in select value from jsonb_array_elements(p_parcels)
  loop
    v_tracking := upper(regexp_replace(btrim(coalesce(v_item->>'trackingNumber', '')), '\\s+', '', 'g'));
    if v_tracking !~ '^[A-Z0-9-]{6,64}$' then
      raise exception using errcode = '22023', message = 'invalid parcel tracking number';
    end if;
    if octet_length(coalesce(v_item->'rawCapture', '{}'::jsonb)::text) > 65536 then
      raise exception using errcode = '22023', message = 'parcel source evidence is too large';
    end if;

    v_source_status := nullif(btrim(coalesce(v_item->>'status', '')), '');
    v_next_status := case
      when coalesce(v_source_status, '') ~* '(returned|return|退回|退件|拒收)' then 'exception'::public.parcel_status
      when coalesce(v_item->>'pickupCode', '') <> ''
        or coalesce(v_source_status, '') ~* '(ready.*pickup|awaiting.*pickup|待取件|已到驿站|已入库)' then 'delivered'::public.parcel_status
      else 'in_transit'::public.parcel_status
    end;
    if v_next_status = 'delivered' and nullif(btrim(coalesce(v_item->>'pickupCode', '')), '') is null then
      raise exception using errcode = '22023', message = 'pickup code is required for a ready parcel';
    end if;

    select exists(
      select 1 from public.parcels p
      where upper(regexp_replace(btrim(p.tracking_number), '\\s+', '', 'g')) = v_tracking
    ) into v_exists;

    select to_jsonb(p) into v_before
    from public.parcels p
    where upper(regexp_replace(btrim(p.tracking_number), '\\s+', '', 'g')) = v_tracking
    for update;

    insert into public.parcels (
      tracking_number, status, source, source_status, carrier, pickup_code,
      pickup_station, source_arrived_at, source_expected_arrival_at,
      source_last_tracking_update_at, source_synced_at, source_payload,
      cainiao_import_batch_id
    ) values (
      v_tracking, v_next_status, v_source, v_source_status,
      nullif(btrim(v_item->>'carrier'), ''), nullif(btrim(v_item->>'pickupCode'), ''),
      nullif(btrim(v_item->>'pickupStation'), ''),
      nullif(v_item->>'arrivedAt', '')::timestamptz,
      nullif(v_item->>'expectedArrivalAt', '')::timestamptz,
      nullif(v_item->>'lastTrackingUpdateAt', '')::timestamptz,
      now(), coalesce(v_item->'rawCapture', '{}'::jsonb), v_batch_id
    )
    on conflict ((upper(regexp_replace(btrim(tracking_number), '\\s+', '', 'g')))) do update
    set source = excluded.source,
        source_status = coalesce(excluded.source_status, public.parcels.source_status),
        carrier = coalesce(excluded.carrier, public.parcels.carrier),
        pickup_code = coalesce(excluded.pickup_code, public.parcels.pickup_code),
        pickup_station = coalesce(excluded.pickup_station, public.parcels.pickup_station),
        source_arrived_at = coalesce(excluded.source_arrived_at, public.parcels.source_arrived_at),
        source_expected_arrival_at = coalesce(excluded.source_expected_arrival_at, public.parcels.source_expected_arrival_at),
        source_last_tracking_update_at = coalesce(excluded.source_last_tracking_update_at, public.parcels.source_last_tracking_update_at),
        source_synced_at = now(),
        source_payload = excluded.source_payload,
        cainiao_import_batch_id = coalesce(excluded.cainiao_import_batch_id, public.parcels.cainiao_import_batch_id),
        status = case
          when public.parcels.status in ('received', 'partially_received', 'closed') then public.parcels.status
          else excluded.status
        end
    returning * into v_parcel;

    insert into public.parcel_items (parcel_id, order_item_id)
    select distinct v_parcel.id, po.order_item_id
    from public.provider_tracking_captures ptc
    join public.provider_orders po
      on po.provider = ptc.provider
      and po.provider_order_id = ptc.provider_order_id
    where ptc.provider = 'alibaba1688'
      and upper(regexp_replace(btrim(ptc.tracking_number), '\\s+', '', 'g')) = v_tracking
    on conflict (parcel_id, order_item_id) do nothing;

    select count(*) into v_matched
    from public.parcel_items pi
    where pi.parcel_id = v_parcel.id;

    if v_matched > 0 and v_parcel.unmatched_review_status = 'open' then
      update public.parcels
      set unmatched_review_status = 'linked',
          unmatched_reviewed_by = v_actor,
          unmatched_reviewed_at = now(),
          unmatched_review_reason = 'Matched automatically by normalized tracking number.'
      where id = v_parcel.id
      returning * into v_parcel;
    end if;

    perform private.write_audit_log_internal(
      'parcel', v_parcel.id,
      case when v_exists then 'cainiao_parcel_refreshed' else 'cainiao_parcel_discovered' end,
      v_before,
      jsonb_build_object(
        'tracking_number', v_parcel.tracking_number,
        'status', v_parcel.status,
        'pickup_code', v_parcel.pickup_code,
        'source', v_source,
        'import_batch_id', v_batch_id,
        'matched_order_item_count', v_matched
      ),
      null
    );

    if v_batch_id is not null then
      update public.cainiao_import_batches
      set inserted_count = inserted_count + case when v_exists then 0 else 1 end,
          refreshed_count = refreshed_count + case when v_exists then 1 else 0 end,
          matched_count = matched_count + case when v_matched > 0 then 1 else 0 end,
          unmatched_count = unmatched_count + case when v_matched = 0 then 1 else 0 end
      where id = v_batch_id;
    end if;

    return query select v_parcel.tracking_number, v_parcel.id, not v_exists, v_matched, v_parcel.status;
  end loop;
end;
$$;

revoke all on function public.sync_cainiao_parcels(jsonb, text) from public, anon, authenticated;
grant execute on function public.sync_cainiao_parcels(jsonb, text) to service_role;

create or replace function public.sync_cainiao_parcels_for_profile(
  p_profile_id uuid,
  p_import_batch_id uuid,
  p_parcels jsonb,
  p_source text
)
returns table (
  tracking_number text,
  parcel_id uuid,
  inserted boolean,
  matched_order_item_count integer,
  parcel_status public.parcel_status
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.cainiao_import_batches%rowtype;
begin
  if p_profile_id is null or p_import_batch_id is null then
    raise exception using errcode = '22023', message = 'profile and import batch are required';
  end if;
  if jsonb_typeof(p_parcels) <> 'array' or jsonb_array_length(p_parcels) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'one to two hundred parcels are required';
  end if;

  select * into v_batch
  from public.cainiao_import_batches
  where id = p_import_batch_id
    and created_by = p_profile_id
    and source = lower(btrim(coalesce(p_source, '')))
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Cainiao import batch not found';
  end if;

  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.sync_cainiao_parcels(p_parcels, p_source);
  update public.cainiao_import_batches
  set completed_at = now()
  where id = p_import_batch_id;
end;
$$;

revoke all on function public.sync_cainiao_parcels_for_profile(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.sync_cainiao_parcels_for_profile(uuid, uuid, jsonb, text) to service_role;

create or replace function public.collect_cainiao_parcel(p_tracking_number text)
returns table (
  parcel_id uuid,
  tracking_number text,
  parcel_status public.parcel_status,
  collected_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_before jsonb;
  v_parcel public.parcels%rowtype;
  v_tracking text := upper(regexp_replace(btrim(coalesce(p_tracking_number, '')), '\\s+', '', 'g'));
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;
  select public.current_user_role() into v_role;
  if v_role not in ('staff_receiver', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'receiving role required';
  end if;
  if v_tracking !~ '^[A-Z0-9-]{6,64}$' then
    raise exception using errcode = '22023', message = 'invalid parcel tracking number';
  end if;

  select * into v_parcel
  from public.parcels p
  where upper(regexp_replace(btrim(p.tracking_number), '\\s+', '', 'g')) = v_tracking
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'parcel not found';
  end if;
  if v_role = 'staff_receiver'
    and v_parcel.assigned_staff_id is not null
    and v_parcel.assigned_staff_id <> v_actor then
    raise exception using errcode = '42501', message = 'parcel is assigned to another receiver';
  end if;
  if v_parcel.status = 'received' and v_parcel.collected_at is not null then
    return query select v_parcel.id, v_parcel.tracking_number, v_parcel.status, v_parcel.collected_at;
    return;
  end if;
  if v_parcel.source not in ('manual', 'screenshot', 'cainiao', 'taobao') or v_parcel.status <> 'delivered' then
    raise exception using errcode = '23514', message = 'only a ready Cainiao parcel can be collected';
  end if;

  v_before := to_jsonb(v_parcel);
  update public.parcels
  set status = 'received',
      collected_by = v_actor,
      collected_at = now(),
      received_at = coalesce(received_at, now()),
      assigned_staff_id = coalesce(assigned_staff_id, v_actor)
  where id = v_parcel.id
  returning * into v_parcel;

  perform private.write_audit_log_internal(
    'parcel', v_parcel.id, 'cainiao_parcel_collected', v_before,
    jsonb_build_object('tracking_number', v_parcel.tracking_number, 'status', v_parcel.status, 'collected_at', v_parcel.collected_at),
    null
  );

  return query select v_parcel.id, v_parcel.tracking_number, v_parcel.status, v_parcel.collected_at;
end;
$$;

revoke all on function public.collect_cainiao_parcel(text) from public, anon, authenticated;
grant execute on function public.collect_cainiao_parcel(text) to service_role;
