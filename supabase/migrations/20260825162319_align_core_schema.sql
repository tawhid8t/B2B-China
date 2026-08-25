-- Forward-only alignment migration for the schema introduced by
-- 001_initial_schema.sql. Existing business columns are retained for
-- compatibility. Recovery should use Supabase backup/PITR rather than a
-- destructive down migration.

-- ---------------------------------------------------------------------------
-- Enums and canonical status domains
-- ---------------------------------------------------------------------------

alter type public.order_status add value if not exists 'arrived_guangzhou' after 'sent_guangzhou';
alter type public.order_status add value if not exists 'sent_bangladesh' after 'arrived_guangzhou';
alter type public.order_status add value if not exists 'ready_for_pickup' after 'arrived_bangladesh';
alter type public.order_status add value if not exists 'exception' after 'cancelled';

alter type public.qc_status add value if not exists 'admin_approved' after 'missing';

alter type public.wallet_transaction_type add value if not exists 'reservation' after 'adjustment';
alter type public.wallet_transaction_type add value if not exists 'reservation_release' after 'reservation';

create type public.estimate_status as enum (
  'draft',
  'sent_to_client',
  'accepted',
  'rejected',
  'expired',
  'converted_to_order',
  'cancelled'
);

create type public.order_group_status as enum (
  'open',
  'full',
  'packing',
  'sent_guangzhou',
  'arrived_guangzhou',
  'sent_bangladesh',
  'arrived_bangladesh',
  'ready_for_pickup',
  'completed',
  'cancelled',
  'exception'
);

create type public.payment_status as enum (
  'pending',
  'needs_review',
  'approved',
  'rejected',
  'cancelled'
);

create type public.wallet_transaction_status as enum (
  'pending',
  'posted',
  'reversed',
  'cancelled'
);

create type public.purchase_batch_status as enum (
  'open',
  'sent_to_extension',
  'partially_purchased',
  'purchased',
  'closed',
  'cancelled',
  'exception'
);

create type public.provider_order_status as enum (
  'created',
  'paid',
  'seller_processing',
  'seller_shipped',
  'delivered_china',
  'cancelled',
  'refund_requested',
  'refunded',
  'exception'
);

create type public.parcel_status as enum (
  'expected',
  'in_transit',
  'delivered',
  'received',
  'partially_received',
  'unknown',
  'exception',
  'closed'
);

-- This enum intentionally supports the full documented lifecycle while the
-- existing `packed` default remains unchanged pending OC-003 owner approval.
create type public.carton_status as enum (
  'draft',
  'packed',
  'label_printed',
  'sent_guangzhou',
  'arrived_guangzhou',
  'sent_bangladesh',
  'arrived_bangladesh',
  'ready_for_pickup',
  'completed',
  'exception',
  'cancelled'
);

create type public.tracking_status as enum (
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
  'delivered',
  'exception',
  'manual_recorded',
  'unknown'
);

create type public.integration_status as enum (
  'pending',
  'success',
  'failed',
  'retrying',
  'manual_required'
);

create type public.exception_status as enum (
  'open',
  'assigned',
  'waiting_client',
  'waiting_supplier',
  'resolved',
  'cancelled'
);

-- ---------------------------------------------------------------------------
-- Existing-table alignment (additive columns; legacy columns are retained)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column email text,
  add column updated_at timestamptz not null default now();

alter table public.clients
  add column whatsapp_number text,
  add column bangladesh_pickup_name text,
  add column bangladesh_pickup_phone text,
  add column bangladesh_pickup_address text,
  add column updated_at timestamptz not null default now();

create unique index clients_profile_id_key on public.clients (profile_id);

alter table public.product_links
  alter column provider_item_id drop not null,
  add column title_cn text,
  add column price_min_cny numeric(12,2),
  add column price_max_cny numeric(12,2),
  add column source_status text not null default 'active',
  add column created_by uuid references public.profiles(id) on delete restrict,
  add column updated_at timestamptz not null default now(),
  add constraint product_links_domestic_delivery_nonnegative
    check (domestic_delivery_cny >= 0),
  add constraint product_links_price_min_nonnegative
    check (price_min_cny is null or price_min_cny >= 0),
  add constraint product_links_price_max_nonnegative
    check (price_max_cny is null or price_max_cny >= 0),
  add constraint product_links_price_range_valid
    check (price_min_cny is null or price_max_cny is null or price_min_cny <= price_max_cny);

comment on column public.product_links.sku_matrix is
  'Legacy denormalized provider payload retained for compatibility; product_skus is canonical for SKU relationships.';

create table public.product_skus (
  id uuid primary key default gen_random_uuid(),
  product_link_id uuid not null references public.product_links(id) on delete restrict,
  provider_sku_id text,
  label text not null check (nullif(btrim(label), '') is not null),
  attributes jsonb not null default '{}'::jsonb,
  price_cny numeric(12,2) not null check (price_cny >= 0),
  available_quantity integer check (available_quantity is null or available_quantity >= 0),
  image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_skus_provider_identity_key
  on public.product_skus (product_link_id, provider_sku_id)
  where provider_sku_id is not null;

alter table public.estimates
  alter column sku_id drop not null,
  add column product_sku_id uuid references public.product_skus(id) on delete restrict,
  add column unit_price_cny numeric(12,2),
  add column domestic_delivery_cny numeric(12,2) not null default 0,
  add column estimated_unit_weight_kg numeric(10,3),
  add column estimated_total_weight_kg numeric(10,3),
  add column exchange_rate_cny_to_bdt numeric(10,4),
  add column category_shipping_bdt numeric(12,2),
  add column china_to_guangzhou_bdt numeric(12,2),
  add column profit_bdt numeric(12,2),
  add column notes text,
  add column updated_at timestamptz not null default now(),
  add constraint estimates_unit_price_nonnegative
    check (unit_price_cny is null or unit_price_cny >= 0),
  add constraint estimates_domestic_delivery_nonnegative
    check (domestic_delivery_cny >= 0),
  add constraint estimates_unit_weight_positive
    check (estimated_unit_weight_kg is null or estimated_unit_weight_kg > 0),
  add constraint estimates_total_weight_positive
    check (estimated_total_weight_kg is null or estimated_total_weight_kg > 0),
  add constraint estimates_exchange_rate_positive
    check (exchange_rate_cny_to_bdt is null or exchange_rate_cny_to_bdt > 0),
  add constraint estimates_category_shipping_nonnegative
    check (category_shipping_bdt is null or category_shipping_bdt >= 0),
  add constraint estimates_china_to_guangzhou_nonnegative
    check (china_to_guangzhou_bdt is null or china_to_guangzhou_bdt >= 0),
  add constraint estimates_profit_nonnegative
    check (profit_bdt is null or profit_bdt >= 0),
  add constraint estimates_total_nonnegative
    check (total_bdt >= 0);

-- Legacy rows predate normalized estimate snapshots. The NOT VALID constraint
-- preserves those rows while enforcing complete snapshots for new writes.
alter table public.estimates
  add constraint estimates_required_snapshot_values check (
    unit_price_cny is not null
    and exchange_rate_cny_to_bdt is not null
    and category_shipping_bdt is not null
    and china_to_guangzhou_bdt is not null
    and profit_bdt is not null
  ) not valid;

alter table public.estimates alter column status drop default;
alter table public.estimates
  alter column status type public.estimate_status
  using status::public.estimate_status;
alter table public.estimates alter column status set default 'draft'::public.estimate_status;

comment on column public.estimates.sku_id is
  'Legacy provider SKU identifier retained for compatibility; product_sku_id is the normalized relationship.';

alter table public.order_groups
  add column updated_at timestamptz not null default now(),
  add constraint order_groups_fulfilled_count_range
    check (fulfilled_item_count between 0 and 40),
  add constraint order_groups_estimated_total_nonnegative
    check (estimated_total_bdt >= 0),
  add constraint order_groups_actual_total_nonnegative
    check (actual_total_bdt >= 0);

alter table public.order_groups alter column status drop default;
alter table public.order_groups
  alter column status type public.order_group_status
  using status::public.order_group_status;
alter table public.order_groups alter column status set default 'open'::public.order_group_status;

alter table public.order_items
  alter column sku_id drop not null,
  add column product_sku_id uuid references public.product_skus(id) on delete restrict,
  add column estimated_total_bdt numeric(14,2),
  add column actual_total_bdt numeric(14,2),
  add column admin_notes text,
  add column client_notes text,
  add constraint order_items_price_nonnegative check (cny_price >= 0),
  add constraint order_items_domestic_delivery_nonnegative check (domestic_delivery_cny >= 0),
  add constraint order_items_estimated_weight_positive
    check (estimated_weight_kg is null or estimated_weight_kg > 0),
  add constraint order_items_actual_weight_positive
    check (actual_weight_kg is null or actual_weight_kg > 0),
  add constraint order_items_estimated_total_nonnegative
    check (estimated_total_bdt is null or estimated_total_bdt >= 0),
  add constraint order_items_actual_total_nonnegative
    check (actual_total_bdt is null or actual_total_bdt >= 0),
  add constraint order_items_no_estimate_requested_status
    check (status <> 'estimate_requested'::public.order_status);

create unique index order_items_estimate_id_key
  on public.order_items (estimate_id)
  where estimate_id is not null;

create table public.order_status_events (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  from_status public.order_status,
  to_status public.order_status not null,
  changed_by uuid references public.profiles(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now()
);

create table public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  amount_bdt numeric(14,2) not null check (amount_bdt > 0),
  paid_at date not null,
  proof_file_path text,
  status public.payment_status not null default 'pending',
  notes text,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_proofs_review_metadata_valid check (
    (status in ('pending', 'needs_review') and reviewed_at is null)
    or (status in ('approved', 'rejected', 'cancelled'))
  ),
  constraint payment_proofs_rejection_reason_required check (
    status <> 'rejected' or nullif(btrim(rejection_reason), '') is not null
  )
);

alter table public.wallet_transactions
  add column payment_proof_id uuid references public.payment_proofs(id) on delete restrict,
  add column order_item_id uuid references public.order_items(id) on delete restrict,
  add column order_group_id uuid references public.order_groups(id) on delete restrict,
  add column product_link_id uuid references public.product_links(id) on delete restrict,
  add column created_by uuid references public.profiles(id) on delete restrict,
  add constraint wallet_transactions_rate_positive check (cny_to_bdt_rate > 0),
  add constraint wallet_transactions_has_amount check (amount_bdt <> 0 or amount_cny <> 0);

alter table public.wallet_transactions alter column status drop default;
alter table public.wallet_transactions
  alter column status type public.wallet_transaction_status
  using status::public.wallet_transaction_status;
alter table public.wallet_transactions alter column status set default 'pending'::public.wallet_transaction_status;

comment on column public.wallet_transactions.running_balance_cny is
  'Per-entry ledger snapshot for reconciliation; it is not an independently mutable wallet balance.';

alter table public.purchase_batches
  add column batch_code text,
  add column closed_at timestamptz,
  add column updated_at timestamptz not null default now();

create unique index purchase_batches_batch_code_key
  on public.purchase_batches (batch_code)
  where batch_code is not null;

alter table public.purchase_batches alter column status drop default;
alter table public.purchase_batches
  alter column status type public.purchase_batch_status
  using status::public.purchase_batch_status;
alter table public.purchase_batches alter column status set default 'open'::public.purchase_batch_status;

create table public.purchase_batch_items (
  id uuid primary key default gen_random_uuid(),
  purchase_batch_id uuid not null references public.purchase_batches(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  status text not null default 'queued',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_batch_items_identity_key unique (purchase_batch_id, order_item_id),
  constraint purchase_batch_items_status_nonempty check (nullif(btrim(status), '') is not null)
);

alter table public.provider_orders
  add column status public.provider_order_status not null default 'created',
  add column raw_payload jsonb,
  add column updated_at timestamptz not null default now(),
  add constraint provider_orders_paid_amount_nonnegative
    check (paid_amount_cny is null or paid_amount_cny >= 0);

comment on column public.provider_orders.provider_status is
  'Provider-supplied raw status; status is the normalized internal lifecycle.';

alter table public.parcels
  alter column order_item_id drop not null,
  add column provider_order_id uuid references public.provider_orders(id) on delete restrict,
  add column status public.parcel_status not null default 'expected',
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint parcels_expected_pieces_nonnegative
    check (expected_pieces is null or expected_pieces >= 0),
  add constraint parcels_received_pieces_nonnegative
    check (received_pieces is null or received_pieces >= 0),
  add constraint parcels_weight_positive
    check (weight_kg is null or weight_kg > 0);

update public.parcels
set status = case
  when received_at is not null
    and expected_pieces is not null
    and received_pieces is not null
    and received_pieces < expected_pieces
    then 'partially_received'::public.parcel_status
  when received_at is not null
    then 'received'::public.parcel_status
  else status
end;

alter table public.parcels
  add constraint parcels_tracking_number_key unique (tracking_number);

comment on column public.parcels.order_item_id is
  'Legacy direct relationship retained for compatibility; parcel_items is canonical.';

create table public.parcel_items (
  id uuid primary key default gen_random_uuid(),
  parcel_id uuid not null references public.parcels(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  expected_pieces integer check (expected_pieces is null or expected_pieces >= 0),
  received_pieces integer check (received_pieces is null or received_pieces >= 0),
  weight_kg numeric(10,3) check (weight_kg is null or weight_kg > 0),
  qc_status public.qc_status not null default 'pending',
  qc_notes text,
  qc_photos text[] not null default '{}',
  checked_by uuid references public.profiles(id) on delete restrict,
  checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parcel_items_identity_key unique (parcel_id, order_item_id)
);

insert into public.parcel_items (
  parcel_id,
  order_item_id,
  expected_pieces,
  received_pieces,
  weight_kg,
  qc_status,
  qc_photos,
  checked_by,
  checked_at,
  created_at,
  updated_at
)
select
  id,
  order_item_id,
  expected_pieces,
  received_pieces,
  weight_kg,
  qc_status,
  photos,
  assigned_staff_id,
  received_at,
  coalesce(received_at, now()),
  now()
from public.parcels
where order_item_id is not null
on conflict (parcel_id, order_item_id) do nothing;

alter table public.cartons
  alter column order_item_ids set default '{}',
  add column updated_at timestamptz not null default now(),
  add constraint cartons_net_weight_nonnegative check (net_weight_kg >= 0),
  add constraint cartons_gross_weight_positive check (gross_weight_kg > 0),
  add constraint cartons_weight_order_valid check (gross_weight_kg >= net_weight_kg);

alter table public.cartons alter column status drop default;
alter table public.cartons
  alter column status type public.carton_status
  using status::public.carton_status;
alter table public.cartons alter column status set default 'packed'::public.carton_status;

comment on column public.cartons.order_item_ids is
  'Legacy denormalized relationship retained for compatibility; carton_items is canonical.';

create table public.carton_items (
  id uuid primary key default gen_random_uuid(),
  carton_id uuid not null references public.cartons(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer check (quantity is null or quantity > 0),
  created_at timestamptz not null default now(),
  constraint carton_items_identity_key unique (carton_id, order_item_id)
);

insert into public.carton_items (carton_id, order_item_id, created_at)
select distinct cartons.id, item_id, cartons.created_at
from public.cartons as cartons
cross join lateral unnest(cartons.order_item_ids) as items(item_id)
on conflict (carton_id, order_item_id) do nothing;

alter table public.shipping_rates
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint shipping_rates_rate_positive check (bdt_per_kg > 0);

alter table public.exchange_rates
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint exchange_rates_rate_positive check (cny_to_bdt > 0);

alter table public.profit_rules
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint profit_rules_percentage_nonnegative
    check (percentage is null or percentage >= 0),
  add constraint profit_rules_fixed_nonnegative
    check (fixed_bdt is null or fixed_bdt >= 0),
  add constraint profit_rules_has_component
    check (percentage is not null or fixed_bdt is not null);

alter table public.category_rules
  add column requires_separate_carton boolean not null default false,
  add column created_at timestamptz not null default now(),
  add column updated_at timestamptz not null default now(),
  add constraint category_rules_weight_positive check (default_weight_kg > 0);

create table public.tracking_events (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (nullif(btrim(entity_type), '') is not null),
  entity_id uuid not null,
  tracking_number text,
  courier_name text,
  status public.tracking_status not null,
  location text,
  description text,
  event_time timestamptz,
  raw_payload jsonb,
  created_at timestamptz not null default now()
);

alter table public.notifications
  add column entity_type text,
  add column entity_id uuid;

alter table public.audit_logs
  add column reason text;

alter table public.integration_logs
  add column updated_at timestamptz not null default now();

alter table public.integration_logs alter column status drop default;
alter table public.integration_logs
  alter column status type public.integration_status
  using status::public.integration_status;

create table public.exceptions (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (nullif(btrim(entity_type), '') is not null),
  entity_id uuid not null,
  exception_type text not null check (nullif(btrim(exception_type), '') is not null),
  severity text not null default 'medium' check (severity in ('low', 'medium', 'high', 'critical')),
  description text not null,
  assigned_admin_id uuid references public.profiles(id) on delete restrict,
  status public.exception_status not null default 'open',
  resolution_note text,
  created_by uuid references public.profiles(id) on delete restrict,
  resolved_by uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint exceptions_resolution_metadata_valid check (
    status <> 'resolved'
    or (resolved_at is not null and nullif(btrim(resolution_note), '') is not null)
  )
);

-- ---------------------------------------------------------------------------
-- Relationship and query indexes
-- ---------------------------------------------------------------------------

create index clients_assigned_admin_id_idx on public.clients (assigned_admin_id);
create index product_links_category_idx on public.product_links (category);
create index product_links_created_at_idx on public.product_links (created_at);
create index product_links_created_by_idx on public.product_links (created_by);
create index product_skus_product_link_id_idx on public.product_skus (product_link_id);

create index estimates_client_id_idx on public.estimates (client_id);
create index estimates_product_link_id_idx on public.estimates (product_link_id);
create index estimates_product_sku_id_idx on public.estimates (product_sku_id);
create index estimates_status_idx on public.estimates (status);
create index estimates_created_at_idx on public.estimates (created_at);

create index order_groups_client_status_idx on public.order_groups (client_id, status);
create index order_groups_created_at_idx on public.order_groups (created_at);

create index order_items_client_id_idx on public.order_items (client_id);
create index order_items_group_id_idx on public.order_items (group_id);
create index order_items_product_link_id_idx on public.order_items (product_link_id);
create index order_items_product_sku_id_idx on public.order_items (product_sku_id);
create index order_items_status_idx on public.order_items (status);
create index order_items_created_at_idx on public.order_items (created_at);

create index order_status_events_order_item_created_idx
  on public.order_status_events (order_item_id, created_at);
create index order_status_events_changed_by_idx on public.order_status_events (changed_by);

create index payment_proofs_client_id_idx on public.payment_proofs (client_id);
create index payment_proofs_status_idx on public.payment_proofs (status);
create index payment_proofs_reviewed_by_idx on public.payment_proofs (reviewed_by);

create index wallet_transactions_client_created_idx
  on public.wallet_transactions (client_id, created_at);
create index wallet_transactions_payment_proof_id_idx on public.wallet_transactions (payment_proof_id);
create index wallet_transactions_order_item_id_idx on public.wallet_transactions (order_item_id);
create index wallet_transactions_order_group_id_idx on public.wallet_transactions (order_group_id);
create index wallet_transactions_product_link_id_idx on public.wallet_transactions (product_link_id);
create index wallet_transactions_created_by_idx on public.wallet_transactions (created_by);
create index wallet_transactions_approved_by_idx on public.wallet_transactions (approved_by);

create index purchase_batches_created_by_idx on public.purchase_batches (created_by);
create index purchase_batch_items_order_item_id_idx on public.purchase_batch_items (order_item_id);

create index provider_orders_order_item_id_idx on public.provider_orders (order_item_id);
create index provider_orders_purchase_batch_id_idx on public.provider_orders (purchase_batch_id);
create index provider_orders_provider_order_id_idx on public.provider_orders (provider_order_id);
create index provider_orders_seller_tracking_number_idx on public.provider_orders (seller_tracking_number);
create index provider_orders_status_idx on public.provider_orders (status);

create index parcels_order_item_id_idx on public.parcels (order_item_id);
create index parcels_provider_order_id_idx on public.parcels (provider_order_id);
create index parcels_assigned_staff_id_idx on public.parcels (assigned_staff_id);
create index parcels_status_idx on public.parcels (status);

create index parcel_items_order_item_id_idx on public.parcel_items (order_item_id);
create index parcel_items_qc_status_idx on public.parcel_items (qc_status);
create index parcel_items_checked_by_idx on public.parcel_items (checked_by);

create index cartons_client_id_idx on public.cartons (client_id);
create index cartons_status_idx on public.cartons (status);
create index cartons_guangzhou_tracking_number_idx on public.cartons (guangzhou_tracking_number);
create index cartons_created_by_idx on public.cartons (created_by);
create index carton_items_order_item_id_idx on public.carton_items (order_item_id);

create index exchange_rates_created_by_idx on public.exchange_rates (created_by);

create index tracking_events_entity_idx on public.tracking_events (entity_type, entity_id);
create index tracking_events_tracking_number_idx on public.tracking_events (tracking_number);
create index tracking_events_event_time_idx on public.tracking_events (event_time);

create index notifications_profile_read_idx on public.notifications (profile_id, read_at);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);
create index audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at);
create index integration_logs_provider_operation_idx on public.integration_logs (provider, operation);
create index integration_logs_status_idx on public.integration_logs (status);
create index integration_logs_created_at_idx on public.integration_logs (created_at);

create index exceptions_entity_idx on public.exceptions (entity_type, entity_id);
create index exceptions_assigned_admin_id_idx on public.exceptions (assigned_admin_id);
create index exceptions_status_idx on public.exceptions (status);
create index exceptions_created_at_idx on public.exceptions (created_at);
create index exceptions_created_by_idx on public.exceptions (created_by);
create index exceptions_resolved_by_idx on public.exceptions (resolved_by);

-- ---------------------------------------------------------------------------
-- Timestamp, history, and append-only enforcement
-- ---------------------------------------------------------------------------

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated, service_role;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger clients_set_updated_at
before update on public.clients
for each row execute function private.set_updated_at();

create trigger product_links_set_updated_at
before update on public.product_links
for each row execute function private.set_updated_at();

create trigger product_skus_set_updated_at
before update on public.product_skus
for each row execute function private.set_updated_at();

create trigger estimates_set_updated_at
before update on public.estimates
for each row execute function private.set_updated_at();

create trigger order_groups_set_updated_at
before update on public.order_groups
for each row execute function private.set_updated_at();

create trigger order_items_set_updated_at
before update on public.order_items
for each row execute function private.set_updated_at();

create trigger payment_proofs_set_updated_at
before update on public.payment_proofs
for each row execute function private.set_updated_at();

create trigger purchase_batches_set_updated_at
before update on public.purchase_batches
for each row execute function private.set_updated_at();

create trigger purchase_batch_items_set_updated_at
before update on public.purchase_batch_items
for each row execute function private.set_updated_at();

create trigger provider_orders_set_updated_at
before update on public.provider_orders
for each row execute function private.set_updated_at();

create trigger parcels_set_updated_at
before update on public.parcels
for each row execute function private.set_updated_at();

create trigger parcel_items_set_updated_at
before update on public.parcel_items
for each row execute function private.set_updated_at();

create trigger cartons_set_updated_at
before update on public.cartons
for each row execute function private.set_updated_at();

create trigger shipping_rates_set_updated_at
before update on public.shipping_rates
for each row execute function private.set_updated_at();

create trigger exchange_rates_set_updated_at
before update on public.exchange_rates
for each row execute function private.set_updated_at();

create trigger profit_rules_set_updated_at
before update on public.profit_rules
for each row execute function private.set_updated_at();

create trigger category_rules_set_updated_at
before update on public.category_rules
for each row execute function private.set_updated_at();

create trigger integration_logs_set_updated_at
before update on public.integration_logs
for each row execute function private.set_updated_at();

create trigger exceptions_set_updated_at
before update on public.exceptions
for each row execute function private.set_updated_at();

create or replace function private.record_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_events (order_item_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_events (order_item_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, auth.uid());
  end if;

  return new;
end;
$$;

revoke all on function private.record_order_status_event() from public, anon, authenticated;

create trigger order_items_record_status_event
after insert or update of status on public.order_items
for each row execute function private.record_order_status_event();

insert into public.order_status_events (order_item_id, from_status, to_status, reason, created_at)
select id, null, status, 'Backfilled current status during schema alignment', created_at
from public.order_items
where not exists (
  select 1
  from public.order_status_events
  where order_status_events.order_item_id = order_items.id
);

create or replace function private.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only; create a new event or correction row', tg_table_name
    using errcode = '55000';
end;
$$;

create trigger order_status_events_append_only
before update or delete on public.order_status_events
for each row execute function private.prevent_append_only_mutation();

create trigger tracking_events_append_only
before update or delete on public.tracking_events
for each row execute function private.prevent_append_only_mutation();

create trigger audit_logs_append_only
before update or delete on public.audit_logs
for each row execute function private.prevent_append_only_mutation();

create or replace function private.protect_posted_wallet_transaction()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'wallet transactions are append-only; cancel pending entries or create an adjustment row'
      using errcode = '55000';
  end if;

  if old.status <> 'pending'::public.wallet_transaction_status then
    raise exception 'finalized wallet transactions are immutable; create an adjustment row'
      using errcode = '55000';
  end if;

  if new.status not in (
    'posted'::public.wallet_transaction_status,
    'cancelled'::public.wallet_transaction_status
  ) then
    raise exception 'pending wallet transactions may only be posted or cancelled'
      using errcode = '23514';
  end if;

  if row(
    new.client_id,
    new.transaction_type,
    new.amount_bdt,
    new.amount_cny,
    new.cny_to_bdt_rate,
    new.running_balance_cny,
    new.payment_proof_id,
    new.order_item_id,
    new.order_group_id,
    new.product_link_id
  ) is distinct from row(
    old.client_id,
    old.transaction_type,
    old.amount_bdt,
    old.amount_cny,
    old.cny_to_bdt_rate,
    old.running_balance_cny,
    old.payment_proof_id,
    old.order_item_id,
    old.order_group_id,
    old.product_link_id
  ) then
    raise exception 'wallet financial fields are immutable; cancel and create a corrected entry'
      using errcode = '55000';
  end if;

  return new;
end;
$$;

create trigger wallet_transactions_protect_posted
before update or delete on public.wallet_transactions
for each row execute function private.protect_posted_wallet_transaction();

create or replace function private.protect_approved_payment_proof()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = 'approved'::public.payment_status then
    raise exception 'approved payment proofs are immutable'
      using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger payment_proofs_protect_approved
before update or delete on public.payment_proofs
for each row execute function private.protect_approved_payment_proof();

-- Keep the privileged lookup in a non-exposed schema. The public compatibility
-- wrapper is security invoker and returns only the caller's own role.
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
$$;

revoke all on function private.current_user_role() from public, anon, authenticated;
grant execute on function private.current_user_role() to authenticated, service_role;

create or replace function public.current_user_role()
returns public.user_role
language sql
security invoker
stable
set search_path = ''
as $$
  select private.current_user_role()
$$;

revoke all on function public.current_user_role() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS coverage and agreed role boundaries
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.product_links enable row level security;
alter table public.product_skus enable row level security;
alter table public.estimates enable row level security;
alter table public.order_groups enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.payment_proofs enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.purchase_batches enable row level security;
alter table public.purchase_batch_items enable row level security;
alter table public.provider_orders enable row level security;
alter table public.parcels enable row level security;
alter table public.parcel_items enable row level security;
alter table public.cartons enable row level security;
alter table public.carton_items enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.profit_rules enable row level security;
alter table public.category_rules enable row level security;
alter table public.tracking_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.integration_logs enable row level security;
alter table public.exceptions enable row level security;

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role;

alter policy "users can read own profile" on public.profiles to authenticated;
alter policy "clients read own client row" on public.clients to authenticated;
alter policy "admins manage clients" on public.clients to authenticated;
alter policy "admins read all product links" on public.product_links to authenticated;
alter policy "clients read own estimates" on public.estimates to authenticated;
alter policy "clients read own orders" on public.order_items to authenticated;
alter policy "clients read own groups" on public.order_groups to authenticated;
alter policy "clients read own wallet" on public.wallet_transactions to authenticated;
alter policy "staff read parcels" on public.parcels to authenticated;
alter policy "staff read cartons" on public.cartons to authenticated;
alter policy "users read own notifications" on public.notifications to authenticated;

drop policy "admins manage profiles" on public.profiles;
create policy "super admins manage profiles"
on public.profiles for all
to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

drop policy "authenticated create product links" on public.product_links;
create policy "admins manage product links"
on public.product_links for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "authenticated read product skus"
on public.product_skus for select
to authenticated
using (true);

create policy "admins manage product skus"
on public.product_skus for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "clients create own estimates"
on public.estimates for insert
to authenticated
with check (
  client_id in (select id from public.clients where profile_id = (select auth.uid()))
);

create policy "admins manage estimates"
on public.estimates for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage order groups"
on public.order_groups for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage order items"
on public.order_items for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "clients read own order status events"
on public.order_status_events for select
to authenticated
using (
  order_item_id in (
    select id
    from public.order_items
    where client_id in (select id from public.clients where profile_id = (select auth.uid()))
  )
  or (select public.current_user_role()) in ('admin', 'super_admin', 'staff_receiver', 'staff_packer')
);

create policy "clients read own payment proofs"
on public.payment_proofs for select
to authenticated
using (
  client_id in (select id from public.clients where profile_id = (select auth.uid()))
  or (select public.current_user_role()) in ('admin', 'super_admin')
);

create policy "clients create own payment proofs"
on public.payment_proofs for insert
to authenticated
with check (
  client_id in (select id from public.clients where profile_id = (select auth.uid()))
  and status = 'pending'::public.payment_status
  and reviewed_by is null
  and reviewed_at is null
);

create policy "admins manage payment proofs"
on public.payment_proofs for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage wallet transactions"
on public.wallet_transactions for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage purchase batches"
on public.purchase_batches for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage purchase batch items"
on public.purchase_batch_items for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage provider orders"
on public.provider_orders for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "receivers manage parcels"
on public.parcels for all
to authenticated
using ((select public.current_user_role()) in ('staff_receiver', 'admin', 'super_admin'))
with check ((select public.current_user_role()) in ('staff_receiver', 'admin', 'super_admin'));

create policy "warehouse staff read parcel items"
on public.parcel_items for select
to authenticated
using ((select public.current_user_role()) in ('staff_receiver', 'staff_packer', 'admin', 'super_admin'));

create policy "receivers manage parcel items"
on public.parcel_items for all
to authenticated
using ((select public.current_user_role()) in ('staff_receiver', 'admin', 'super_admin'))
with check ((select public.current_user_role()) in ('staff_receiver', 'admin', 'super_admin'));

create policy "packers manage cartons"
on public.cartons for all
to authenticated
using ((select public.current_user_role()) in ('staff_packer', 'admin', 'super_admin'))
with check ((select public.current_user_role()) in ('staff_packer', 'admin', 'super_admin'));

create policy "packers manage carton items"
on public.carton_items for all
to authenticated
using ((select public.current_user_role()) in ('staff_packer', 'admin', 'super_admin'))
with check ((select public.current_user_role()) in ('staff_packer', 'admin', 'super_admin'));

create policy "authenticated read shipping rates"
on public.shipping_rates for select
to authenticated
using (active or (select public.current_user_role()) in ('admin', 'super_admin'));

create policy "authenticated read exchange rates"
on public.exchange_rates for select
to authenticated
using (true);

create policy "authenticated read category rules"
on public.category_rules for select
to authenticated
using (true);

create policy "admins read profit rules"
on public.profit_rules for select
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "super admins manage shipping rates"
on public.shipping_rates for all
to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy "super admins manage exchange rates"
on public.exchange_rates for all
to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy "super admins manage profit rules"
on public.profit_rules for all
to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy "super admins manage category rules"
on public.category_rules for all
to authenticated
using ((select public.current_user_role()) = 'super_admin')
with check ((select public.current_user_role()) = 'super_admin');

create policy "operations staff read tracking events"
on public.tracking_events for select
to authenticated
using ((select public.current_user_role()) in ('staff_receiver', 'staff_packer', 'admin', 'super_admin'));

create policy "operations staff create tracking events"
on public.tracking_events for insert
to authenticated
with check ((select public.current_user_role()) in ('staff_receiver', 'staff_packer', 'admin', 'super_admin'));

create policy "users mark own notifications read"
on public.notifications for update
to authenticated
using (profile_id = (select auth.uid()))
with check (profile_id = (select auth.uid()));

create policy "admins read audit logs"
on public.audit_logs for select
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage integration logs"
on public.integration_logs for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "admins manage exceptions"
on public.exceptions for all
to authenticated
using ((select public.current_user_role()) in ('admin', 'super_admin'))
with check ((select public.current_user_role()) in ('admin', 'super_admin'));

create policy "warehouse staff create exceptions"
on public.exceptions for insert
to authenticated
with check (
  (select public.current_user_role()) in ('staff_receiver', 'staff_packer')
  and status = 'open'::public.exception_status
  and resolved_by is null
  and resolved_at is null
);
