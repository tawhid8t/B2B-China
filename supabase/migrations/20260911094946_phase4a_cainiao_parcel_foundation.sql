-- Cainiao parcel foundation. `parcels` remains the physical-parcel source of
-- truth; `parcel_items` remains the canonical many-to-many order-item link.
alter table public.parcels
  add column source text not null default 'manual',
  add column source_status text,
  add column carrier text,
  add column pickup_code text,
  add column pickup_station text,
  add column source_arrived_at timestamptz,
  add column source_expected_arrival_at timestamptz,
  add column source_last_tracking_update_at timestamptz,
  add column source_synced_at timestamptz,
  add column source_payload jsonb not null default '{}'::jsonb,
  add column collected_by uuid references public.profiles(id) on delete restrict,
  add column collected_at timestamptz,
  add constraint parcels_source_nonempty check (nullif(btrim(source), '') is not null),
  add constraint parcels_collection_pair check (
    (collected_by is null and collected_at is null)
    or (collected_by is not null and collected_at is not null)
  );

comment on column public.parcels.provider_order_id is
  'Legacy single provider-order anchor. New multi-item parcel matching is canonical in parcel_items.';
comment on column public.parcels.source_payload is
  'Compact Cainiao/Taobao source evidence only; never browser cookies, tokens, or full response payloads.';

create unique index parcels_tracking_number_normalized_key
  on public.parcels ((upper(regexp_replace(btrim(tracking_number), '\\s+', '', 'g'))));
create index parcels_cainiao_collection_queue_idx
  on public.parcels (status, source_synced_at desc)
  where source in ('cainiao', 'taobao');

-- Receiver staff must not be able to change provider relationships, costs, or
-- QC fields through a broad table update. Collection is handled by the narrow
-- RPC below; later QC gets its own separately approved capability.
drop policy if exists parcels_receiver_insert on public.parcels;
drop policy if exists parcels_receiver_update on public.parcels;
drop policy if exists "receivers manage parcels" on public.parcels;
drop policy if exists parcel_items_receiver_insert on public.parcel_items;
drop policy if exists parcel_items_receiver_update on public.parcel_items;
drop policy if exists "receivers manage parcel items" on public.parcel_items;

create or replace function public.sync_cainiao_parcels(
  p_parcels jsonb,
  p_source text default 'cainiao'
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
  v_before jsonb;
  v_parcel public.parcels%rowtype;
  v_exists boolean;
  v_source_status text;
  v_next_status public.parcel_status;
  v_matched integer;
begin
  if v_actor is null or public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;
  if v_source not in ('cainiao', 'taobao') then
    raise exception using errcode = '22023', message = 'unsupported parcel source';
  end if;
  if jsonb_typeof(p_parcels) <> 'array' or jsonb_array_length(p_parcels) > 200 then
    raise exception using errcode = '22023', message = 'one to two hundred parcels are required';
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
      source_last_tracking_update_at, source_synced_at, source_payload
    ) values (
      v_tracking, v_next_status, v_source, v_source_status,
      nullif(btrim(v_item->>'carrier'), ''), nullif(btrim(v_item->>'pickupCode'), ''),
      nullif(btrim(v_item->>'pickupStation'), ''),
      nullif(v_item->>'arrivedAt', '')::timestamptz,
      nullif(v_item->>'expectedArrivalAt', '')::timestamptz,
      nullif(v_item->>'lastTrackingUpdateAt', '')::timestamptz,
      now(), coalesce(v_item->'rawCapture', '{}'::jsonb)
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

    perform private.write_audit_log_internal(
      'parcel', v_parcel.id,
      case when v_exists then 'cainiao_parcel_refreshed' else 'cainiao_parcel_discovered' end,
      v_before,
      jsonb_build_object(
        'tracking_number', v_parcel.tracking_number,
        'status', v_parcel.status,
        'pickup_code', v_parcel.pickup_code,
        'matched_order_item_count', v_matched
      ),
      null
    );

    return query select v_parcel.tracking_number, v_parcel.id, not v_exists, v_matched, v_parcel.status;
  end loop;
end;
$$;

revoke all on function public.sync_cainiao_parcels(jsonb, text) from public, anon;
grant execute on function public.sync_cainiao_parcels(jsonb, text) to authenticated, service_role;

create or replace function public.sync_cainiao_parcels_for_credential(
  p_profile_id uuid,
  p_parcels jsonb,
  p_source text default 'cainiao'
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
begin
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.sync_cainiao_parcels(p_parcels, p_source);
end;
$$;

revoke all on function public.sync_cainiao_parcels_for_credential(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.sync_cainiao_parcels_for_credential(uuid, jsonb, text) to service_role;

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
  if v_parcel.source not in ('cainiao', 'taobao') or v_parcel.status <> 'delivered' then
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

revoke all on function public.collect_cainiao_parcel(text) from public, anon;
grant execute on function public.collect_cainiao_parcel(text) to authenticated, service_role;
