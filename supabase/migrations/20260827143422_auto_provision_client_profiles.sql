-- Auto-provision the business client record required by client ordering.
--
-- The auth signup trigger already creates a public.profiles row with the
-- safe default role of "client". Phase 6B direct order confirmation now uses
-- the canonical public.clients.id, so a signed-in client without this row
-- cannot confirm an order. This migration keeps the existing auth/profile
-- architecture and adds the missing one-to-one client provisioning.

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_full_name text;
begin
  v_full_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'User'
  );

  -- Role metadata is intentionally ignored so signup cannot grant elevated
  -- access through user-controlled raw_user_meta_data.
  insert into public.profiles (id, role, full_name, email)
  values (new.id, 'client', v_full_name, new.email)
  on conflict (id) do update
    set email = coalesce(public.profiles.email, excluded.email),
        full_name = coalesce(nullif(btrim(public.profiles.full_name), ''), excluded.full_name);

  insert into public.clients (
    profile_id,
    business_name,
    bangladesh_pickup_details,
    risk_flags
  )
  values (
    new.id,
    v_full_name,
    '{}'::jsonb,
    '{}'::text[]
  )
  on conflict (profile_id) do nothing;

  return new;
end;
$$;

revoke all on function private.handle_new_auth_user() from public, anon, authenticated;

comment on function private.handle_new_auth_user()
is 'Creates the default client profile and matching business client row for new Auth users.';

insert into public.clients (
  profile_id,
  business_name,
  bangladesh_pickup_details,
  risk_flags
)
select
  p.id,
  coalesce(
    nullif(btrim(p.full_name), ''),
    nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
    'Client'
  ) as business_name,
  '{}'::jsonb as bangladesh_pickup_details,
  '{}'::text[] as risk_flags
from public.profiles p
left join public.clients c on c.profile_id = p.id
where p.role = 'client'
  and c.id is null
on conflict (profile_id) do nothing;
