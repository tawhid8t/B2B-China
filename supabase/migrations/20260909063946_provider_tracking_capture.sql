create table public.provider_tracking_captures (
 id uuid primary key default gen_random_uuid(), provider text not null default 'alibaba1688', provider_order_id text not null, tracking_number text not null, raw_capture jsonb not null default '{}'::jsonb, captured_by uuid references public.profiles(id) on delete restrict, captured_at timestamptz not null default now(), unique(provider,provider_order_id,tracking_number)
);
alter table public.provider_tracking_captures enable row level security;
create policy provider_tracking_captures_admin_manage on public.provider_tracking_captures for all to authenticated using ((select public.current_user_role()) in ('admin','super_admin')) with check ((select public.current_user_role()) in ('admin','super_admin'));
create or replace function public.record_provider_tracking_capture(p_provider_order_id text,p_tracking_numbers jsonb,p_raw_capture jsonb default '{}'::jsonb) returns table (tracking_number text, inserted boolean) language plpgsql security invoker set search_path='' as $$
declare v_tracking text; v_exists boolean;
begin
 if (select auth.uid()) is null or public.current_user_role() not in ('admin','super_admin') then raise exception using errcode='42501',message='admin role required'; end if;
 if not exists(select 1 from public.provider_orders where provider='alibaba1688' and provider_order_id=btrim(p_provider_order_id)) then raise exception using errcode='P0002',message='approved provider order not found'; end if;
 if jsonb_typeof(p_tracking_numbers)<>'array' or jsonb_array_length(p_tracking_numbers)>20 then raise exception using errcode='22023',message='one to twenty tracking numbers are required'; end if;
 for v_tracking in select distinct btrim(value #>> '{}') from jsonb_array_elements(p_tracking_numbers) loop
   if v_tracking !~ '^[A-Za-z0-9-]{6,64}$' then raise exception using errcode='22023',message='invalid seller tracking number'; end if;
   select exists(select 1 from public.provider_tracking_captures where provider='alibaba1688' and provider_order_id=btrim(p_provider_order_id) and tracking_number=v_tracking) into v_exists;
   insert into public.provider_tracking_captures(provider_order_id,tracking_number,raw_capture,captured_by) values(btrim(p_provider_order_id),v_tracking,coalesce(p_raw_capture,'{}'::jsonb),auth.uid()) on conflict(provider,provider_order_id,tracking_number) do update set captured_at=now(),raw_capture=excluded.raw_capture;
   return query select v_tracking,not v_exists;
 end loop;
 perform private.write_audit_log_internal('provider_order',(select id from public.provider_orders where provider='alibaba1688' and provider_order_id=btrim(p_provider_order_id) limit 1),'seller_tracking_refreshed',null,jsonb_build_object('tracking_numbers',p_tracking_numbers),null);
end; $$;
revoke all on function public.record_provider_tracking_capture(text,jsonb,jsonb) from public,anon; grant execute on function public.record_provider_tracking_capture(text,jsonb,jsonb) to authenticated,service_role;
create or replace function public.record_provider_tracking_capture_for_credential(p_profile_id uuid,p_provider_order_id text,p_tracking_numbers jsonb,p_raw_capture jsonb default '{}'::jsonb) returns table (tracking_number text, inserted boolean) language plpgsql security definer set search_path='' as $$ begin perform set_config('request.jwt.claim.sub',p_profile_id::text,true); return query select * from public.record_provider_tracking_capture(p_provider_order_id,p_tracking_numbers,p_raw_capture); end; $$;
revoke all on function public.record_provider_tracking_capture_for_credential(uuid,text,jsonb,jsonb) from public,anon,authenticated; grant execute on function public.record_provider_tracking_capture_for_credential(uuid,text,jsonb,jsonb) to service_role;
