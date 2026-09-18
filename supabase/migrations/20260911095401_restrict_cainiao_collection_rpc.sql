-- Collection is intentionally server-mediated. The future staff API performs
-- normal session authorization, then calls this service-role-only wrapper with
-- the verified profile ID. This prevents arbitrary authenticated RPC access.
revoke execute on function public.collect_cainiao_parcel(text) from authenticated;

create or replace function public.collect_cainiao_parcel_for_profile(
  p_profile_id uuid,
  p_tracking_number text
)
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
begin
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.collect_cainiao_parcel(p_tracking_number);
end;
$$;

revoke all on function public.collect_cainiao_parcel_for_profile(uuid, text) from public, anon, authenticated;
grant execute on function public.collect_cainiao_parcel_for_profile(uuid, text) to service_role;
