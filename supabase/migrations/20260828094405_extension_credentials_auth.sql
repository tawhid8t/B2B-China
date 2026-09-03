-- Credential hashes only; raw extension credentials never enter the database.
begin;

create table public.extension_credentials (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete restrict,
  token_hash text not null unique check (length(token_hash) = 64),
  label text,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  constraint extension_credentials_expiry_after_creation check (expires_at is null or expires_at > created_at)
);

create index extension_credentials_profile_id_idx on public.extension_credentials(profile_id);
create index extension_credentials_active_hash_idx on public.extension_credentials(token_hash) where revoked_at is null;

alter table public.extension_credentials enable row level security;
revoke all on public.extension_credentials from anon;

create policy "credential owners read their credentials"
on public.extension_credentials for select to authenticated
using (profile_id = (select auth.uid()) or (select public.current_user_role()) = 'super_admin');

create policy "admins create their own credentials"
on public.extension_credentials for insert to authenticated
with check (
  ((select public.current_user_role()) in ('admin', 'super_admin'))
  and (profile_id = (select auth.uid()) or (select public.current_user_role()) = 'super_admin')
);

create policy "credential owners revoke credentials"
on public.extension_credentials for update to authenticated
using (profile_id = (select auth.uid()) or (select public.current_user_role()) = 'super_admin')
with check (profile_id = (select auth.uid()) or (select public.current_user_role()) = 'super_admin');

create or replace function public.get_extension_purchase_queue_for_credential(p_profile_id uuid)
returns table (
  order_item_id uuid, purchase_batch_id uuid, provider text, product_url text, provider_item_id text,
  provider_sku_id text, sku_label text, attributes jsonb, quantity integer,
  expected_unit_price_cny numeric(14,2), expected_domestic_delivery_cny numeric(14,2), product_image text
)
language plpgsql security definer set search_path = ''
as $$
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service role required'; end if;
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.get_extension_purchase_queue();
end;
$$;

create or replace function public.sync_provider_order_and_commit_wallet_for_credential(
  p_profile_id uuid, p_order_item_id uuid, p_provider text, p_provider_order_id text, p_paid_amount_cny numeric,
  p_seller_tracking_number text, p_provider_status text, p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null, p_purchase_batch_id uuid default null, p_provider_sku_id text default null,
  p_quantity_purchased integer default null, p_actual_unit_price_cny numeric default null,
  p_actual_product_subtotal_cny numeric default null, p_actual_domestic_delivery_cny numeric default null,
  p_actual_discount_cny numeric default null, p_purchased_at timestamptz default null
)
returns table (provider_order_record_id uuid, order_item_status public.order_status, synced_at timestamptz,
  reservation_transaction_id uuid, release_transaction_id uuid, debit_transaction_id uuid,
  debited_amount_cny numeric(14,2), uncovered_amount_cny numeric(14,2), applied_rate numeric(10,4))
language plpgsql security definer set search_path = ''
as $$
begin
  if current_user <> 'service_role' then raise exception using errcode = '42501', message = 'service role required'; end if;
  perform set_config('request.jwt.claim.sub', p_profile_id::text, true);
  return query select * from public.sync_provider_order_and_commit_wallet_v2(
    p_order_item_id, p_provider, p_provider_order_id, p_paid_amount_cny, p_seller_tracking_number,
    p_provider_status, p_raw_payload, p_cny_to_bdt_rate, p_purchase_batch_id, p_provider_sku_id,
    p_quantity_purchased, p_actual_unit_price_cny, p_actual_product_subtotal_cny,
    p_actual_domestic_delivery_cny, p_actual_discount_cny, p_purchased_at
  );
end;
$$;

revoke all on function public.get_extension_purchase_queue_for_credential(uuid) from public, anon, authenticated;
grant execute on function public.get_extension_purchase_queue_for_credential(uuid) to service_role;
revoke all on function public.sync_provider_order_and_commit_wallet_for_credential(uuid, uuid, text, text, numeric, text, text, jsonb, numeric, uuid, text, integer, numeric, numeric, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.sync_provider_order_and_commit_wallet_for_credential(uuid, uuid, text, text, numeric, text, text, jsonb, numeric, uuid, text, integer, numeric, numeric, numeric, numeric, timestamptz) to service_role;

commit;
