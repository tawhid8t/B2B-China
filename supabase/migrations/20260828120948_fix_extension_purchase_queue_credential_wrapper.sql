-- The credential route invokes this wrapper with the server-only service-role
-- client.  In a SECURITY DEFINER function current_user is the function owner,
-- not the invoking service_role, so access must be enforced through function
-- privileges (revoked from every browser-facing role below).
begin;

create or replace function public.get_extension_purchase_queue_for_credential(p_profile_id uuid)
returns table (
  order_item_id uuid, purchase_batch_id uuid, provider text, product_url text, provider_item_id text,
  provider_sku_id text, sku_label text, attributes jsonb, quantity integer,
  expected_unit_price_cny numeric(14,2), expected_domestic_delivery_cny numeric(14,2), product_image text
)
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.get_extension_purchase_queue();
end;
$$;

revoke all on function public.get_extension_purchase_queue_for_credential(uuid) from public, anon, authenticated;
grant execute on function public.get_extension_purchase_queue_for_credential(uuid) to service_role;

commit;
