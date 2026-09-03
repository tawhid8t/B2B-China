begin;

create table public.operational_settings (
  id uuid primary key default gen_random_uuid(),
  key text not null check (nullif(btrim(key), '') is not null),
  numeric_value numeric(14,4) not null check (numeric_value > 0),
  unit text not null check (nullif(btrim(unit), '') is not null),
  active boolean not null default true,
  effective_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operational_settings_validity_minutes_integer check (
    key <> 'estimate_validity_minutes'
    or numeric_value = trunc(numeric_value)
  )
);

create unique index operational_settings_one_active_key
  on public.operational_settings (key)
  where active;

create index operational_settings_history_idx
  on public.operational_settings (key, effective_at desc);

comment on table public.operational_settings is
  'Versioned global numeric settings used by server-side operational calculations.';
comment on column public.operational_settings.numeric_value is
  'Persisted decimal value; interpretation is defined by key and unit and snapshotted into business records.';

-- Persist the existing MVP operational defaults. Future changes create a new
-- active row after deactivating the prior version; estimates retain snapshots.
insert into public.operational_settings (id, key, numeric_value, unit, effective_at)
values
  ('9a000000-0000-0000-0000-000000000001', 'china_to_guangzhou_bdt_per_kg', 35.0000, 'BDT_PER_KG', now()),
  ('9a000000-0000-0000-0000-000000000002', 'estimate_validity_minutes', 1440.0000, 'MINUTES', now());

alter table public.operational_settings enable row level security;
alter table public.operational_settings force row level security;

grant select, insert, update, delete on public.operational_settings to authenticated;

create policy operational_settings_admin_select
on public.operational_settings for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy operational_settings_owner_manage
on public.operational_settings for all to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create trigger operational_settings_set_updated_at
before update on public.operational_settings
for each row execute function private.set_updated_at();

create trigger operational_settings_audit
after insert or update or delete on public.operational_settings
for each row execute function private.audit_row_change();

-- A completed server calculation is immediately client-visible. Ownership is
-- unchanged: client tokens may insert only for their own client record.
create policy estimates_insert_own_sent_to_client
on public.estimates for insert to authenticated
with check (
  (select public.current_user_role()) = 'client'
  and client_id in (
    select id from public.clients where profile_id = (select auth.uid())
  )
  and status = 'sent_to_client'::public.estimate_status
);

create trigger estimates_creation_audit
after insert on public.estimates
for each row execute function private.audit_row_change();

create or replace function private.get_estimate_calculation_context_internal(
  p_client_id uuid,
  p_product_link_id uuid,
  p_product_sku_id uuid
)
returns table (
  client_id uuid,
  product_link_id uuid,
  product_sku_id uuid,
  unit_price_cny numeric,
  domestic_delivery_cny numeric,
  category text,
  default_weight_kg numeric,
  exchange_rate_id uuid,
  exchange_rate_cny_to_bdt numeric,
  exchange_rate_source text,
  exchange_rate_effective_on date,
  shipping_rate_id uuid,
  shipping_rate_bdt_per_kg numeric,
  profit_rule_id uuid,
  profit_rule_name text,
  profit_rule_category text,
  profit_rule_percentage numeric,
  profit_rule_fixed_bdt numeric,
  guangzhou_setting_id uuid,
  guangzhou_bdt_per_kg numeric,
  validity_setting_id uuid,
  validity_minutes integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.user_role;
  v_product public.product_links%rowtype;
  v_sku public.product_skus%rowtype;
  v_exchange public.exchange_rates%rowtype;
  v_shipping public.shipping_rates%rowtype;
  v_profit public.profit_rules%rowtype;
  v_category public.category_rules%rowtype;
  v_guangzhou public.operational_settings%rowtype;
  v_validity public.operational_settings%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  v_role := public.current_user_role();
  if v_role is null or v_role not in ('client', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'estimate access denied';
  end if;

  if not exists (select 1 from public.clients where id = p_client_id) then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  if v_role = 'client' and not exists (
    select 1
    from public.clients
    where id = p_client_id
      and profile_id = auth.uid()
  ) then
    raise exception using errcode = '42501', message = 'client estimate access denied';
  end if;

  select *
  into v_product
  from public.product_links
  where id = p_product_link_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'product not found';
  end if;

  if v_product.source_status <> 'active' then
    raise exception using
      errcode = 'P0001',
      message = 'product availability requires manual review';
  end if;

  select *
  into v_sku
  from public.product_skus
  where id = p_product_sku_id
    and product_link_id = p_product_link_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'product SKU not found';
  end if;

  if v_sku.available_quantity = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'product SKU availability requires manual review';
  end if;

  select *
  into v_exchange
  from public.exchange_rates
  where effective_on <= current_date
  order by effective_on desc, created_at desc
  limit 1;

  select *
  into v_shipping
  from public.shipping_rates
  where category = v_product.category
    and active
  order by updated_at desc
  limit 1;

  select *
  into v_profit
  from public.profit_rules
  where active
    and (category = v_product.category or category is null)
  order by (category = v_product.category) desc, updated_at desc
  limit 1;

  select *
  into v_category
  from public.category_rules
  where category = v_product.category
  limit 1;

  select *
  into v_guangzhou
  from public.operational_settings
  where key = 'china_to_guangzhou_bdt_per_kg'
    and active
    and effective_at <= now()
  order by effective_at desc
  limit 1;

  select *
  into v_validity
  from public.operational_settings
  where key = 'estimate_validity_minutes'
    and active
    and effective_at <= now()
  order by effective_at desc
  limit 1;

  if v_exchange.id is null
     or v_shipping.id is null
     or v_profit.id is null
     or v_guangzhou.id is null
     or v_validity.id is null then
    raise exception using
      errcode = 'P0001',
      message = 'estimate configuration is incomplete and requires manual review';
  end if;

  return query select
    p_client_id,
    v_product.id,
    v_sku.id,
    v_sku.price_cny,
    v_product.domestic_delivery_cny,
    v_product.category,
    v_category.default_weight_kg,
    v_exchange.id,
    v_exchange.cny_to_bdt,
    v_exchange.source,
    v_exchange.effective_on,
    v_shipping.id,
    v_shipping.bdt_per_kg,
    v_profit.id,
    v_profit.name,
    v_profit.category,
    v_profit.percentage,
    v_profit.fixed_bdt,
    v_guangzhou.id,
    v_guangzhou.numeric_value,
    v_validity.id,
    v_validity.numeric_value::integer;
end;
$$;

revoke all on function private.get_estimate_calculation_context_internal(uuid, uuid, uuid)
  from public, anon;
grant execute on function private.get_estimate_calculation_context_internal(uuid, uuid, uuid)
  to authenticated, service_role;

create or replace function public.get_estimate_calculation_context(
  p_client_id uuid,
  p_product_link_id uuid,
  p_product_sku_id uuid
)
returns table (
  client_id uuid,
  product_link_id uuid,
  product_sku_id uuid,
  unit_price_cny numeric,
  domestic_delivery_cny numeric,
  category text,
  default_weight_kg numeric,
  exchange_rate_id uuid,
  exchange_rate_cny_to_bdt numeric,
  exchange_rate_source text,
  exchange_rate_effective_on date,
  shipping_rate_id uuid,
  shipping_rate_bdt_per_kg numeric,
  profit_rule_id uuid,
  profit_rule_name text,
  profit_rule_category text,
  profit_rule_percentage numeric,
  profit_rule_fixed_bdt numeric,
  guangzhou_setting_id uuid,
  guangzhou_bdt_per_kg numeric,
  validity_setting_id uuid,
  validity_minutes integer
)
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.get_estimate_calculation_context_internal(
    p_client_id,
    p_product_link_id,
    p_product_sku_id
  );
$$;

revoke all on function public.get_estimate_calculation_context(uuid, uuid, uuid)
  from public, anon;
grant execute on function public.get_estimate_calculation_context(uuid, uuid, uuid)
  to authenticated, service_role;

commit;
