begin;

-- SECURITY DEFINER runs as its owner, so current_user cannot identify the
-- PostgREST caller. The request role claim is set from the validated API key.
create or replace function public.confirm_product_order_for_purchase_for_profile(
  p_profile_id uuid,
  p_product_order_id uuid
)
returns table (
  product_order_id uuid,
  purchase_batch_id uuid,
  order_item_ids uuid[],
  order_status public.order_status
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if current_setting('request.jwt.claim.role', true) <> 'service_role' then
    raise exception using errcode = '42501', message = 'service role required';
  end if;

  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.confirm_product_order_for_purchase(p_product_order_id);
end;
$$;

revoke all on function public.confirm_product_order_for_purchase_for_profile(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.confirm_product_order_for_purchase_for_profile(uuid, uuid)
  to service_role;

commit;
