-- Production-oriented RLS for the currently implemented MVP schema.
-- Recovery: the prior policy definitions remain in
-- 20260825162319_align_core_schema.sql and can be restored in a forward migration.

-- Inactive application users must not retain role-based database access.
create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
stable
set search_path = ''
as $$
  select role
  from public.profiles
  where id = (select auth.uid())
    and status = 'active'
$$;

revoke all on function private.current_user_role() from public, anon, authenticated;
grant execute on function private.current_user_role() to authenticated, service_role;

-- Remove legacy permissive policies before installing the complete policy set.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'profiles', 'clients', 'product_links', 'product_skus', 'estimates',
        'order_groups', 'order_items', 'order_status_events', 'payment_proofs',
        'wallet_transactions', 'purchase_batches', 'purchase_batch_items',
        'provider_orders', 'parcels', 'parcel_items', 'cartons', 'carton_items',
        'shipping_rates', 'exchange_rates', 'profit_rules', 'category_rules',
        'tracking_events', 'notifications', 'audit_logs', 'integration_logs',
        'exceptions'
      )
  loop
    execute format(
      'drop policy %I on %I.%I',
      existing_policy.policyname,
      existing_policy.schemaname,
      existing_policy.tablename
    );
  end loop;
end;
$$;

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'profiles', 'clients', 'product_links', 'product_skus', 'estimates',
    'order_groups', 'order_items', 'order_status_events', 'payment_proofs',
    'wallet_transactions', 'purchase_batches', 'purchase_batch_items',
    'provider_orders', 'parcels', 'parcel_items', 'cartons', 'carton_items',
    'shipping_rates', 'exchange_rates', 'profit_rules', 'category_rules',
    'tracking_events', 'notifications', 'audit_logs', 'integration_logs',
    'exceptions'
  ]
  loop
    execute format('alter table public.%I enable row level security', protected_table);
    execute format('alter table public.%I force row level security', protected_table);
  end loop;
end;
$$;

-- Privileges are deliberately narrower than RLS. Both layers must allow access.
revoke all on all tables in schema public from anon, authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.clients to authenticated;
grant select, insert, update, delete on public.product_links, public.product_skus to authenticated;
grant select, insert, update, delete on public.estimates, public.order_groups, public.order_items to authenticated;
grant select on public.order_status_events to authenticated;
grant select, insert, update on public.payment_proofs to authenticated;
grant select, insert, update, delete on public.wallet_transactions to authenticated;
grant select, insert, update, delete on public.purchase_batches, public.purchase_batch_items to authenticated;
grant select, insert, update on public.provider_orders to authenticated;
grant select, insert, update on public.parcels, public.parcel_items, public.cartons to authenticated;
grant select, insert, update, delete on public.carton_items to authenticated;
grant select, insert, update, delete on public.shipping_rates, public.exchange_rates, public.profit_rules, public.category_rules to authenticated;
grant select, insert on public.tracking_events to authenticated;
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant select on public.audit_logs to authenticated;
grant select, insert, update on public.integration_logs to authenticated;
grant select, insert, update on public.exceptions to authenticated;

-- Identity and client tenancy.
create policy profiles_select_self_or_admin
on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

create policy profiles_owner_manage
on public.profiles for all to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy clients_select_own_or_admin
on public.clients for select to authenticated
using (
  ((select public.current_user_role()) = 'client' and profile_id = (select auth.uid()))
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

create policy clients_admin_manage
on public.clients for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Product snapshots are direct-table data for administrators only. Staff use
-- the limited queue functions below; clients receive product data through
-- their estimate/order responses rather than raw provider payloads.
create policy product_links_admin_manage
on public.product_links for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy product_skus_admin_manage
on public.product_skus for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Client-owned estimates, groups, orders, and status history.
create policy estimates_select_own
on public.estimates for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy estimates_insert_own
on public.estimates for insert to authenticated
with check (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
  and status = 'draft'::public.estimate_status
);

create policy estimates_admin_manage
on public.estimates for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy order_groups_select_own
on public.order_groups for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy order_groups_admin_manage
on public.order_groups for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy order_items_select_own
on public.order_items for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy order_items_admin_manage
on public.order_items for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy order_status_events_select_own_or_admin
on public.order_status_events for select to authenticated
using (
  (
    (select public.current_user_role()) = 'client'
    and order_item_id in (
      select id from public.order_items
      where client_id in (select id from public.clients where profile_id = (select auth.uid()))
    )
  )
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

-- Financial tables are never available to warehouse staff.
create policy payment_proofs_select_own
on public.payment_proofs for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy payment_proofs_insert_own_pending
on public.payment_proofs for insert to authenticated
with check (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
  and status = 'pending'::public.payment_status
  and reviewed_by is null
  and reviewed_at is null
  and rejection_reason is null
);

create policy payment_proofs_admin_manage
on public.payment_proofs for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy wallet_transactions_select_own
on public.wallet_transactions for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy wallet_transactions_admin_select
on public.wallet_transactions for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy wallet_transactions_admin_insert
on public.wallet_transactions for insert to authenticated
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy wallet_transactions_admin_protected_update
on public.wallet_transactions for update to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy wallet_transactions_admin_protected_delete
on public.wallet_transactions for delete to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Purchasing is operational admin data and includes supplier payment details.
create policy purchase_batches_admin_manage
on public.purchase_batches for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy purchase_batch_items_admin_manage
on public.purchase_batch_items for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy provider_orders_admin_manage
on public.provider_orders for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Receiving staff see and mutate only unassigned/self-assigned receiving rows.
create policy parcels_select_own_client
on public.parcels for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and order_item_id in (
    select id from public.order_items
    where client_id in (select id from public.clients where profile_id = (select auth.uid()))
  )
);

create policy parcels_receiver_select
on public.parcels for select to authenticated
using (
  (select public.current_user_role()) = 'staff_receiver'
  and (assigned_staff_id is null or assigned_staff_id = (select auth.uid()))
);

create policy parcels_receiver_insert
on public.parcels for insert to authenticated
with check (
  (select public.current_user_role()) = 'staff_receiver'
  and (assigned_staff_id is null or assigned_staff_id = (select auth.uid()))
);

create policy parcels_receiver_update
on public.parcels for update to authenticated
using (
  (select public.current_user_role()) = 'staff_receiver'
  and (assigned_staff_id is null or assigned_staff_id = (select auth.uid()))
)
with check (
  (select public.current_user_role()) = 'staff_receiver'
  and assigned_staff_id = (select auth.uid())
);

create policy parcels_admin_manage
on public.parcels for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy parcel_items_select_own_client
on public.parcel_items for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and order_item_id in (
    select id from public.order_items
    where client_id in (select id from public.clients where profile_id = (select auth.uid()))
  )
);

create policy parcel_items_receiver_select
on public.parcel_items for select to authenticated
using (
  (select public.current_user_role()) = 'staff_receiver'
  and parcel_id in (
    select id from public.parcels
    where assigned_staff_id is null or assigned_staff_id = (select auth.uid())
  )
);

create policy parcel_items_receiver_insert
on public.parcel_items for insert to authenticated
with check (
  (select public.current_user_role()) = 'staff_receiver'
  and (checked_by is null or checked_by = (select auth.uid()))
  and parcel_id in (
    select id from public.parcels
    where assigned_staff_id is null or assigned_staff_id = (select auth.uid())
  )
);

create policy parcel_items_receiver_update
on public.parcel_items for update to authenticated
using (
  (select public.current_user_role()) = 'staff_receiver'
  and parcel_id in (
    select id from public.parcels
    where assigned_staff_id is null or assigned_staff_id = (select auth.uid())
  )
)
with check (
  (select public.current_user_role()) = 'staff_receiver'
  and checked_by = (select auth.uid())
  and parcel_id in (
    select id from public.parcels
    where assigned_staff_id = (select auth.uid())
  )
);

create policy parcel_items_admin_manage
on public.parcel_items for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Packing staff can manage cartons without any access to financial tables.
create policy cartons_select_own_client
on public.cartons for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy cartons_packer_manage
on public.cartons for all to authenticated
using ((select public.current_user_role()) = 'staff_packer')
with check (
  (select public.current_user_role()) = 'staff_packer'
  and created_by = (select auth.uid())
);

create policy cartons_admin_manage
on public.cartons for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy carton_items_select_own_client
on public.carton_items for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and carton_id in (
    select id from public.cartons
    where client_id in (select id from public.clients where profile_id = (select auth.uid()))
  )
);

create policy carton_items_packer_manage
on public.carton_items for all to authenticated
using ((select public.current_user_role()) = 'staff_packer')
with check ((select public.current_user_role()) = 'staff_packer');

create policy carton_items_admin_manage
on public.carton_items for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Settings: operational admins read; only owner accounts mutate. Warehouse
-- roles never see financial rate/profit data.
create policy shipping_rates_client_or_admin_select
on public.shipping_rates for select to authenticated
using (
  active
  and (select public.current_user_role()) in ('client', 'admin', 'super_admin')
);

create policy shipping_rates_owner_manage
on public.shipping_rates for all to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy exchange_rates_admin_select
on public.exchange_rates for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy exchange_rates_owner_manage
on public.exchange_rates for all to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy profit_rules_admin_select
on public.profit_rules for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy profit_rules_owner_manage
on public.profit_rules for all to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy category_rules_allowed_select
on public.category_rules for select to authenticated
using ((select public.current_user_role()) in ('client', 'staff_packer', 'admin', 'super_admin'));

create policy category_rules_owner_manage
on public.category_rules for all to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

-- Tracking visibility follows the related business entity.
create policy tracking_events_client_select_own
on public.tracking_events for select to authenticated
using (
  (select public.current_user_role()) = 'client'
  and (
    (entity_type = 'order_item' and entity_id in (
      select id from public.order_items
      where client_id in (select id from public.clients where profile_id = (select auth.uid()))
    ))
    or (entity_type = 'order_group' and entity_id in (
      select id from public.order_groups
      where client_id in (select id from public.clients where profile_id = (select auth.uid()))
    ))
    or (entity_type = 'parcel' and entity_id in (select id from public.parcels))
    or (entity_type = 'carton' and entity_id in (select id from public.cartons))
  )
);

create policy tracking_events_receiver_select
on public.tracking_events for select to authenticated
using (
  (select public.current_user_role()) = 'staff_receiver'
  and entity_type = 'parcel'
  and entity_id in (select id from public.parcels)
);

create policy tracking_events_receiver_insert
on public.tracking_events for insert to authenticated
with check (
  (select public.current_user_role()) = 'staff_receiver'
  and entity_type = 'parcel'
  and entity_id in (select id from public.parcels)
);

create policy tracking_events_packer_select
on public.tracking_events for select to authenticated
using (
  (select public.current_user_role()) = 'staff_packer'
  and entity_type = 'carton'
  and entity_id in (select id from public.cartons)
);

create policy tracking_events_packer_insert
on public.tracking_events for insert to authenticated
with check (
  (select public.current_user_role()) = 'staff_packer'
  and entity_type = 'carton'
  and entity_id in (select id from public.cartons)
);

create policy tracking_events_admin_access
on public.tracking_events for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- User notifications and protected operational/audit data.
create policy notifications_select_own_or_admin
on public.notifications for select to authenticated
using (
  profile_id = (select auth.uid())
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

create policy notifications_update_own_read_at
on public.notifications for update to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy audit_logs_admin_select
on public.audit_logs for select to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy integration_logs_admin_manage
on public.integration_logs for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy exceptions_staff_select_own
on public.exceptions for select to authenticated
using (
  (select public.current_user_role()) in ('staff_receiver', 'staff_packer')
  and created_by = (select auth.uid())
);

create policy exceptions_staff_insert_own
on public.exceptions for insert to authenticated
with check (
  (select public.current_user_role()) in ('staff_receiver', 'staff_packer')
  and created_by = (select auth.uid())
  and status = 'open'::public.exception_status
  and assigned_admin_id is null
  and resolved_by is null
  and resolved_at is null
);

create policy exceptions_admin_manage
on public.exceptions for all to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

-- Narrow staff queue RPCs expose only fields required by receiving/packing.
create or replace function private.get_warehouse_receiving_queue_internal()
returns table (
  parcel_id uuid,
  tracking_number text,
  parcel_status public.parcel_status,
  assigned_staff_id uuid,
  order_item_id uuid,
  client_id uuid,
  business_name text,
  product_title text,
  product_images text[],
  sku_label text,
  sku_attributes jsonb,
  expected_pieces integer,
  received_pieces integer,
  weight_kg numeric,
  qc_status public.qc_status,
  order_status public.order_status
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_role public.user_role;
begin
  caller_role := private.current_user_role();
  if (select auth.uid()) is null or caller_role is null or caller_role not in ('staff_receiver', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'receiving access required';
  end if;

  return query
  select
    p.id,
    p.tracking_number,
    p.status,
    p.assigned_staff_id,
    oi.id,
    oi.client_id,
    c.business_name,
    pl.title,
    pl.images,
    ps.label,
    coalesce(ps.attributes, '{}'::jsonb),
    coalesce(pi.expected_pieces, p.expected_pieces),
    coalesce(pi.received_pieces, p.received_pieces),
    coalesce(pi.weight_kg, p.weight_kg),
    coalesce(pi.qc_status, p.qc_status),
    oi.status
  from public.parcels p
  left join public.parcel_items pi on pi.parcel_id = p.id
  join public.order_items oi on oi.id = coalesce(pi.order_item_id, p.order_item_id)
  join public.clients c on c.id = oi.client_id
  join public.product_links pl on pl.id = oi.product_link_id
  left join public.product_skus ps on ps.id = oi.product_sku_id
  where caller_role in ('admin', 'super_admin')
     or p.assigned_staff_id is null
     or p.assigned_staff_id = (select auth.uid());
end;
$$;

revoke all on function private.get_warehouse_receiving_queue_internal() from public, anon;
grant execute on function private.get_warehouse_receiving_queue_internal() to authenticated, service_role;

create or replace function public.get_warehouse_receiving_queue()
returns table (
  parcel_id uuid,
  tracking_number text,
  parcel_status public.parcel_status,
  assigned_staff_id uuid,
  order_item_id uuid,
  client_id uuid,
  business_name text,
  product_title text,
  product_images text[],
  sku_label text,
  sku_attributes jsonb,
  expected_pieces integer,
  received_pieces integer,
  weight_kg numeric,
  qc_status public.qc_status,
  order_status public.order_status
)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_warehouse_receiving_queue_internal()
$$;

revoke all on function public.get_warehouse_receiving_queue() from public, anon;
grant execute on function public.get_warehouse_receiving_queue() to authenticated, service_role;

create or replace function private.get_warehouse_packing_queue_internal()
returns table (
  order_item_id uuid,
  client_id uuid,
  business_name text,
  pickup_name text,
  pickup_phone text,
  pickup_address text,
  product_title text,
  product_images text[],
  sku_label text,
  sku_attributes jsonb,
  quantity integer,
  category text,
  confirmed_weight_kg numeric,
  qc_status public.qc_status
)
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  caller_role public.user_role;
begin
  caller_role := private.current_user_role();
  if (select auth.uid()) is null or caller_role is null or caller_role not in ('staff_packer', 'admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'packing access required';
  end if;

  return query
  select distinct on (oi.id)
    oi.id,
    oi.client_id,
    c.business_name,
    c.bangladesh_pickup_name,
    c.bangladesh_pickup_phone,
    c.bangladesh_pickup_address,
    pl.title,
    pl.images,
    ps.label,
    coalesce(ps.attributes, '{}'::jsonb),
    oi.quantity,
    oi.category,
    coalesce(pi.weight_kg, oi.actual_weight_kg),
    pi.qc_status
  from public.parcel_items pi
  join public.order_items oi on oi.id = pi.order_item_id
  join public.clients c on c.id = oi.client_id
  join public.product_links pl on pl.id = oi.product_link_id
  left join public.product_skus ps on ps.id = oi.product_sku_id
  left join public.carton_items ci on ci.order_item_id = oi.id
  where pi.qc_status in ('pass', 'admin_approved')
    and pi.received_pieces is not null
    and pi.weight_kg is not null
    and ci.id is null
  order by oi.id, pi.updated_at desc;
end;
$$;

revoke all on function private.get_warehouse_packing_queue_internal() from public, anon;
grant execute on function private.get_warehouse_packing_queue_internal() to authenticated, service_role;

create or replace function public.get_warehouse_packing_queue()
returns table (
  order_item_id uuid,
  client_id uuid,
  business_name text,
  pickup_name text,
  pickup_phone text,
  pickup_address text,
  product_title text,
  product_images text[],
  sku_label text,
  sku_attributes jsonb,
  quantity integer,
  category text,
  confirmed_weight_kg numeric,
  qc_status public.qc_status
)
language sql
security invoker
stable
set search_path = ''
as $$
  select * from private.get_warehouse_packing_queue_internal()
$$;

revoke all on function public.get_warehouse_packing_queue() from public, anon;
grant execute on function public.get_warehouse_packing_queue() to authenticated, service_role;
