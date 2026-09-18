-- The extension credential path must reject an empty successful sync so the
-- caller always receives an explicit no-parcels condition instead of a false
-- success. The future API also validates this before invoking the RPC.
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
  if jsonb_typeof(p_parcels) <> 'array' or jsonb_array_length(p_parcels) < 1 then
    raise exception using errcode = '22023', message = 'one to two hundred parcels are required';
  end if;
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.sync_cainiao_parcels(p_parcels, p_source);
end;
$$;

revoke all on function public.sync_cainiao_parcels_for_credential(uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.sync_cainiao_parcels_for_credential(uuid, jsonb, text) to service_role;
