# Database Design

## 1. Purpose

This document defines the Supabase/Postgres database design for the cross-border sourcing and fulfillment platform.

The database must support:

- Client self-ordering
- Taobao/1688 product snapshots
- Estimates and confirmed orders
- Wallet and advance payment accounting
- Admin purchasing
- Seller tracking
- China warehouse receiving
- QC
- Carton packing
- Guangzhou forwarding
- Bangladesh delivery
- Reports, exports, audit logs, and notifications

Supabase Postgres is the source of truth. All important business events should be stored permanently and protected with Row Level Security.

## 2. Design Principles

- Use UUID primary keys for core tables.
- Use append-only ledgers for financial history.
- Store supplier product snapshots so old orders do not change when a listing changes.
- Store both estimated and actual values where the business needs comparison.
- Keep client-visible data separate from admin-only data through RLS and views.
- Every financial/status/manual override action should be auditable.
- Prefer normalized tables for core operations and JSONB for provider-specific raw API payloads.
- Use private Supabase Storage buckets for sensitive files.

## 3. Enums

### `user_role`

```sql
client
staff_receiver
staff_packer
admin
super_admin
```

### `order_status`

```sql
estimate_requested
pending_admin_review
confirmed
queued_for_purchase
purchased
seller_shipped
received_china
qc_checked
packed
sent_guangzhou
arrived_guangzhou
sent_bangladesh
arrived_bangladesh
ready_for_pickup
completed
cancelled
```

### `estimate_status`

```sql
draft
sent_to_client
accepted
rejected
expired
converted_to_order
```

### `payment_status`

```sql
pending
approved
rejected
needs_review
cancelled
```

### `wallet_transaction_type`

```sql
advance_credit
order_debit
refund
adjustment
reservation
reservation_release
```

### `qc_status`

```sql
pending
pass
fail
partial
missing
admin_approved
```

### `carton_status`

```sql
draft
packed
sent_guangzhou
arrived_guangzhou
sent_bangladesh
arrived_bangladesh
ready_for_pickup
completed
exception
```

### `integration_status`

```sql
pending
success
failed
retrying
manual_required
```

## 4. Core Identity Tables

## 4.1 `profiles`

Stores application user information linked to Supabase Auth.

Important columns:

- `id uuid primary key references auth.users(id)`
- `role user_role not null`
- `full_name text not null`
- `phone text`
- `email text`
- `status text not null default 'active'`
- `default_currency text not null default 'BDT'`
- `created_at timestamptz`
- `updated_at timestamptz`

Rules:

- One auth user has one profile.
- Role controls dashboard access.
- Staff should not be able to self-change role.

## 4.2 `clients`

Stores business/customer details for client users.

Important columns:

- `id uuid primary key`
- `profile_id uuid references profiles(id)`
- `business_name text not null`
- `whatsapp_number text`
- `bangladesh_pickup_name text`
- `bangladesh_pickup_phone text`
- `bangladesh_pickup_address text`
- `risk_flags text[]`
- `assigned_admin_id uuid references profiles(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

Rules:

- A client profile may have one client record.
- Admin can assign clients to admin users.

## 5. Product Tables

## 5.1 `product_links`

Stores product snapshots fetched from OTAPI or manually entered by admin.

Important columns:

- `id uuid primary key`
- `original_url text not null`
- `provider text not null`
- `provider_item_id text not null`
- `title text not null`
- `title_cn text`
- `images text[] not null default '{}'`
- `category text not null default 'default'`
- `domestic_delivery_cny numeric(12,2) default 0`
- `price_min_cny numeric(12,2)`
- `price_max_cny numeric(12,2)`
- `raw_payload jsonb`
- `source_status text default 'active'`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`

Indexes:

- Unique index on `provider, provider_item_id`
- Index on `category`
- Index on `created_at`

## 5.2 `product_skus`

Stores normalized SKU/variant options.

Important columns:

- `id uuid primary key`
- `product_link_id uuid references product_links(id)`
- `provider_sku_id text`
- `label text not null`
- `attributes jsonb not null default '{}'`
- `price_cny numeric(12,2) not null`
- `available_quantity integer`
- `image_url text`
- `created_at timestamptz`

Indexes:

- Index on `product_link_id`
- Unique index on `product_link_id, provider_sku_id`

## 6. Estimate Tables

## 6.1 `estimates`

Stores client estimate requests and full cost snapshots.

Important columns:

- `id uuid primary key`
- `client_id uuid references clients(id)`
- `product_link_id uuid references product_links(id)`
- `product_sku_id uuid references product_skus(id)`
- `quantity integer not null`
- `unit_price_cny numeric(12,2) not null`
- `domestic_delivery_cny numeric(12,2) not null default 0`
- `estimated_unit_weight_kg numeric(10,3)`
- `estimated_total_weight_kg numeric(10,3)`
- `exchange_rate_cny_to_bdt numeric(10,4) not null`
- `category_shipping_bdt numeric(12,2) not null`
- `china_to_guangzhou_bdt numeric(12,2) not null`
- `profit_bdt numeric(12,2) not null`
- `total_bdt numeric(14,2) not null`
- `breakdown jsonb not null`
- `status estimate_status not null default 'draft'`
- `valid_until timestamptz not null`
- `created_at timestamptz`

Rules:

- Estimate values are snapshots.
- Recalculation should create a new estimate or revision, not silently rewrite accepted history.

## 7. Order Tables

## 7.1 `order_groups`

Groups client orders into batches of up to 40 fulfilled items.

Important columns:

- `id uuid primary key`
- `client_id uuid references clients(id)`
- `group_code text not null unique`
- `status text not null default 'open'`
- `fulfilled_item_count integer not null default 0`
- `estimated_total_bdt numeric(14,2) default 0`
- `actual_total_bdt numeric(14,2) default 0`
- `created_at timestamptz`
- `closed_at timestamptz`

Indexes:

- Index on `client_id, status`
- Index on `created_at`

Rules:

- New confirmed orders join the active group.
- Group closes when 40 fulfilled order items are reached.

## 7.2 `order_items`

Stores each ordered product/SKU/quantity.

Important columns:

- `id uuid primary key`
- `client_id uuid references clients(id)`
- `group_id uuid references order_groups(id)`
- `estimate_id uuid references estimates(id)`
- `product_link_id uuid references product_links(id)`
- `product_sku_id uuid references product_skus(id)`
- `quantity integer not null`
- `cny_price numeric(12,2) not null`
- `domestic_delivery_cny numeric(12,2) default 0`
- `estimated_weight_kg numeric(10,3)`
- `actual_weight_kg numeric(10,3)`
- `category text not null default 'default'`
- `estimated_total_bdt numeric(14,2)`
- `actual_total_bdt numeric(14,2)`
- `status order_status not null default 'pending_admin_review'`
- `admin_notes text`
- `client_notes text`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- Index on `client_id`
- Index on `group_id`
- Index on `status`
- Index on `created_at`

## 7.3 `order_status_events`

Stores status history for each order item.

Important columns:

- `id uuid primary key`
- `order_item_id uuid references order_items(id)`
- `from_status order_status`
- `to_status order_status not null`
- `changed_by uuid references profiles(id)`
- `reason text`
- `created_at timestamptz`

Rules:

- Do not rely only on the latest status column.
- Status changes should be auditable and reportable.

## 8. Wallet And Payment Tables

## 8.1 `payment_proofs`

Stores client-uploaded payment proof records.

Important columns:

- `id uuid primary key`
- `client_id uuid references clients(id)`
- `amount_bdt numeric(14,2) not null`
- `paid_at date not null`
- `proof_file_path text`
- `status payment_status not null default 'pending'`
- `reviewed_by uuid references profiles(id)`
- `reviewed_at timestamptz`
- `rejection_reason text`
- `created_at timestamptz`

Indexes:

- Index on `client_id`
- Index on `status`

## 8.2 `wallet_transactions`

Append-only financial ledger.

Important columns:

- `id uuid primary key`
- `client_id uuid references clients(id)`
- `payment_proof_id uuid references payment_proofs(id)`
- `order_item_id uuid references order_items(id)`
- `transaction_type wallet_transaction_type not null`
- `amount_bdt numeric(14,2) not null default 0`
- `amount_cny numeric(14,2) not null default 0`
- `cny_to_bdt_rate numeric(10,4) not null`
- `running_balance_cny numeric(14,2) not null`
- `status text not null default 'posted'`
- `notes text`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`

Indexes:

- Index on `client_id, created_at`
- Index on `order_item_id`
- Index on `payment_proof_id`

Rules:

- Approved wallet transactions must not be updated or deleted from normal app flows.
- Corrections must use adjustment transactions.

## 9. Purchasing Tables

## 9.1 `purchase_batches`

Groups order items sent to the Chrome extension.

Important columns:

- `id uuid primary key`
- `batch_code text unique`
- `status text not null default 'open'`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`
- `closed_at timestamptz`

## 9.2 `purchase_batch_items`

Join table between purchase batches and order items.

Important columns:

- `id uuid primary key`
- `purchase_batch_id uuid references purchase_batches(id)`
- `order_item_id uuid references order_items(id)`
- `status text not null default 'queued'`
- `created_at timestamptz`

Indexes:

- Unique index on `purchase_batch_id, order_item_id`
- Index on `order_item_id`

## 9.3 `provider_orders`

Stores provider order/payment/tracking details captured after admin purchase.

Important columns:

- `id uuid primary key`
- `order_item_id uuid references order_items(id)`
- `purchase_batch_id uuid references purchase_batches(id)`
- `provider text not null`
- `provider_order_id text`
- `paid_amount_cny numeric(12,2)`
- `seller_tracking_number text`
- `provider_status text`
- `synced_at timestamptz`
- `raw_payload jsonb`
- `created_at timestamptz`

Indexes:

- Index on `order_item_id`
- Index on `provider_order_id`
- Index on `seller_tracking_number`

## 10. Parcel And Warehouse Tables

## 10.1 `parcels`

Stores seller parcels received at the China address.

Important columns:

- `id uuid primary key`
- `tracking_number text not null`
- `provider_order_id uuid references provider_orders(id)`
- `assigned_staff_id uuid references profiles(id)`
- `status text not null default 'expected'`
- `received_at timestamptz`
- `created_at timestamptz`

Indexes:

- Unique index on `tracking_number`
- Index on `status`

## 10.2 `parcel_items`

Connects parcels to order items and stores receiving details.

Important columns:

- `id uuid primary key`
- `parcel_id uuid references parcels(id)`
- `order_item_id uuid references order_items(id)`
- `expected_pieces integer`
- `received_pieces integer`
- `weight_kg numeric(10,3)`
- `qc_status qc_status not null default 'pending'`
- `qc_notes text`
- `qc_photos text[] default '{}'`
- `checked_by uuid references profiles(id)`
- `checked_at timestamptz`

Indexes:

- Index on `parcel_id`
- Index on `order_item_id`
- Index on `qc_status`

## 11. Carton Tables

## 11.1 `cartons`

Stores repacked cartons sent to Guangzhou.

Important columns:

- `id uuid primary key`
- `client_id uuid references clients(id)`
- `carton_code text not null unique`
- `category text not null`
- `shipping_mark text not null`
- `net_weight_kg numeric(10,3) not null`
- `gross_weight_kg numeric(10,3) not null`
- `guangzhou_tracking_number text`
- `label_file_path text`
- `status carton_status not null default 'packed'`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`
- `updated_at timestamptz`

Indexes:

- Index on `client_id`
- Index on `status`
- Index on `guangzhou_tracking_number`

## 11.2 `carton_items`

Join table between cartons and order items.

Important columns:

- `id uuid primary key`
- `carton_id uuid references cartons(id)`
- `order_item_id uuid references order_items(id)`
- `quantity integer`
- `created_at timestamptz`

Indexes:

- Unique index on `carton_id, order_item_id`
- Index on `order_item_id`

## 12. Settings Tables

## 12.1 `exchange_rates`

Stores historical exchange rates.

Important columns:

- `id uuid primary key`
- `cny_to_bdt numeric(10,4) not null`
- `source text not null default 'admin'`
- `effective_on date not null`
- `created_by uuid references profiles(id)`
- `created_at timestamptz`

Indexes:

- Unique index on `effective_on, source`

## 12.2 `shipping_rates`

Stores category-based international shipping rates.

Important columns:

- `id uuid primary key`
- `category text not null unique`
- `bdt_per_kg numeric(12,2) not null`
- `active boolean not null default true`
- `created_at timestamptz`

## 12.3 `profit_rules`

Stores profit rules.

Important columns:

- `id uuid primary key`
- `name text not null`
- `category text`
- `percentage numeric(6,4)`
- `fixed_bdt numeric(12,2)`
- `active boolean not null default true`
- `created_at timestamptz`

Rules:

- A rule may use percentage, fixed amount, or both.
- Super admin controls active profit rules.

## 12.4 `category_rules`

Stores category defaults and restrictions.

Important columns:

- `id uuid primary key`
- `category text not null unique`
- `default_weight_kg numeric(10,3) not null`
- `restricted boolean not null default false`
- `requires_separate_carton boolean not null default false`
- `notes text`

## 13. Tracking Tables

## 13.1 `tracking_events`

Stores seller, domestic China, Guangzhou, and Bangladesh tracking events.

Important columns:

- `id uuid primary key`
- `entity_type text not null`
- `entity_id uuid not null`
- `tracking_number text`
- `courier_name text`
- `status text not null`
- `location text`
- `description text`
- `event_time timestamptz`
- `raw_payload jsonb`
- `created_at timestamptz`

Indexes:

- Index on `entity_type, entity_id`
- Index on `tracking_number`
- Index on `event_time`

## 14. Notification And Audit Tables

## 14.1 `notifications`

Stores in-app notifications.

Important columns:

- `id uuid primary key`
- `profile_id uuid references profiles(id)`
- `title text not null`
- `body text not null`
- `entity_type text`
- `entity_id uuid`
- `read_at timestamptz`
- `created_at timestamptz`

Indexes:

- Index on `profile_id, read_at`

## 14.2 `audit_logs`

Stores important business changes.

Important columns:

- `id uuid primary key`
- `actor_id uuid references profiles(id)`
- `entity_type text not null`
- `entity_id uuid`
- `action text not null`
- `before_data jsonb`
- `after_data jsonb`
- `reason text`
- `created_at timestamptz`

Indexes:

- Index on `entity_type, entity_id`
- Index on `actor_id`
- Index on `created_at`

## 14.3 `integration_logs`

Stores external API call history.

Important columns:

- `id uuid primary key`
- `provider text not null`
- `operation text not null`
- `request_payload jsonb`
- `response_payload jsonb`
- `status integration_status not null`
- `error_message text`
- `created_at timestamptz`

Indexes:

- Index on `provider, operation`
- Index on `status`
- Index on `created_at`

## 15. Storage Buckets

Recommended Supabase Storage buckets:

- `product-images`
- `payment-proofs`
- `qc-photos`
- `carton-labels`
- `courier-photos`
- `exports`

Bucket rules:

- Product images may be public only if copied from supplier and safe to expose.
- Payment proofs must be private.
- QC photos must be private.
- Carton labels must be private.
- Courier photos must be private.
- Exports must be private and available through signed URLs.

## 16. Row Level Security Rules

### Clients

Clients can read:

- Their own profile
- Their own client record
- Their own product/order/estimate/group rows
- Their own wallet transactions
- Their own payment proofs
- Their own notifications
- Their own invoices/exports

Clients cannot read:

- Other clients
- Staff data
- Admin profit reports
- Supplier account details
- Internal audit logs

### Staff Receiver

Staff receiver can read/update:

- Assigned parcels
- Parcel items
- Receiving data
- QC data

Staff receiver cannot read:

- Client wallet
- Payment proof financial approval data
- Profit settings
- Exchange-rate admin history

### Staff Packer

Staff packer can read/update:

- Packing queue
- Cartons
- Carton items
- Label generation data
- Guangzhou tracking entry

Staff packer cannot read:

- Client wallet
- Admin profit settings
- Payment proofs

### Admin

Admin can manage:

- Clients
- Orders
- Estimates
- Payment proofs
- Wallet operations
- Purchasing
- Parcels
- Cartons
- Reports

### Super Admin

Super admin can manage all tables, users, settings, and policies.

## 17. Important Database Functions

Recommended database functions:

- `current_user_role()`
- `get_client_wallet_balance(client_id)`
- `create_or_get_active_order_group(client_id)`
- `close_group_if_fulfilled_limit_reached(group_id)`
- `post_wallet_transaction(...)`
- `approve_payment_proof(...)`
- `change_order_status(...)`
- `write_audit_log(...)`

## 18. Important Triggers

Recommended triggers:

- Create `profiles` row when Supabase Auth user is created.
- Update `updated_at` timestamps.
- Insert `order_status_events` when order status changes.
- Insert audit log for wallet transactions.
- Insert audit log for rate/profit/shipping setting changes.
- Recalculate order group totals when order item actual cost changes.
- Close order group when fulfilled item count reaches 40.

## 19. Reporting Views

Recommended views:

- `client_order_summary_view`
- `client_wallet_statement_view`
- `admin_profit_report_view`
- `purchase_queue_view`
- `warehouse_receiving_queue_view`
- `packing_queue_view`
- `carton_shipping_report_view`
- `monthly_client_summary_view`

Views should avoid exposing internal-only fields to clients.

## 20. Migration Order

Recommended migration sequence:

1. Create enums.
2. Create identity tables.
3. Create product tables.
4. Create estimate and order tables.
5. Create wallet/payment tables.
6. Create purchasing tables.
7. Create parcel/warehouse tables.
8. Create carton tables.
9. Create settings tables.
10. Create tracking, notification, audit, and integration tables.
11. Create indexes.
12. Create functions.
13. Create triggers.
14. Enable RLS.
15. Add RLS policies.
16. Create reporting views.
17. Create storage buckets and bucket policies.

## 21. MVP Database Defaults

- UUID primary keys for all business tables.
- Timestamps use `timestamptz`.
- Money uses `numeric`, not floating point.
- Wallet ledger is append-only.
- Product data is snapshotted.
- Provider raw responses are stored as JSONB.
- RLS is enabled before production data is added.
- Private files are accessed through signed URLs.
- All critical business changes create audit logs.
