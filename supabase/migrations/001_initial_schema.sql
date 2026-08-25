create type public.user_role as enum ('client', 'staff_receiver', 'staff_packer', 'admin', 'super_admin');
create type public.order_status as enum ('estimate_requested', 'pending_admin_review', 'confirmed', 'queued_for_purchase', 'seller_shipped', 'received_china', 'qc_checked', 'packed', 'sent_guangzhou', 'arrived_bangladesh', 'completed', 'cancelled');
create type public.qc_status as enum ('pending', 'pass', 'fail', 'partial', 'missing');
create type public.wallet_transaction_type as enum ('advance_credit', 'order_debit', 'refund', 'adjustment');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  full_name text not null,
  phone text,
  status text not null default 'active',
  default_currency text not null default 'BDT',
  created_at timestamptz not null default now()
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  business_name text not null,
  bangladesh_pickup_details jsonb not null default '{}',
  risk_flags text[] not null default '{}',
  assigned_admin_id uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.product_links (
  id uuid primary key default gen_random_uuid(),
  original_url text not null,
  provider text not null,
  provider_item_id text not null,
  title text not null,
  images text[] not null default '{}',
  sku_matrix jsonb not null default '[]',
  category text not null default 'default',
  domestic_delivery_cny numeric(12,2) not null default 0,
  raw_payload jsonb,
  created_at timestamptz not null default now(),
  unique(provider, provider_item_id)
);

create table public.order_groups (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  group_code text not null unique,
  status text not null default 'open',
  fulfilled_item_count integer not null default 0,
  estimated_total_bdt numeric(14,2) not null default 0,
  actual_total_bdt numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.estimates (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  product_link_id uuid not null references public.product_links(id),
  sku_id text not null,
  quantity integer not null check (quantity > 0),
  breakdown jsonb not null,
  total_bdt numeric(14,2) not null,
  valid_until timestamptz not null,
  status text not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  group_id uuid references public.order_groups(id),
  estimate_id uuid references public.estimates(id),
  product_link_id uuid not null references public.product_links(id),
  sku_id text not null,
  quantity integer not null check (quantity > 0),
  cny_price numeric(12,2) not null,
  domestic_delivery_cny numeric(12,2) not null default 0,
  estimated_weight_kg numeric(10,3),
  actual_weight_kg numeric(10,3),
  category text not null default 'default',
  status public.order_status not null default 'pending_admin_review',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  transaction_type public.wallet_transaction_type not null,
  amount_bdt numeric(14,2) not null default 0,
  amount_cny numeric(14,2) not null default 0,
  cny_to_bdt_rate numeric(10,4) not null,
  running_balance_cny numeric(14,2) not null,
  proof_file_path text,
  status text not null default 'pending',
  notes text,
  approved_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.purchase_batches (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'open',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.provider_orders (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id),
  purchase_batch_id uuid references public.purchase_batches(id),
  provider text not null,
  provider_order_id text,
  paid_amount_cny numeric(12,2),
  seller_tracking_number text,
  provider_status text,
  synced_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.parcels (
  id uuid primary key default gen_random_uuid(),
  order_item_id uuid not null references public.order_items(id),
  tracking_number text not null,
  expected_pieces integer,
  received_pieces integer,
  weight_kg numeric(10,3),
  qc_status public.qc_status not null default 'pending',
  assigned_staff_id uuid references public.profiles(id),
  photos text[] not null default '{}',
  received_at timestamptz
);

create table public.cartons (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id),
  carton_code text not null unique,
  category text not null,
  net_weight_kg numeric(10,3) not null,
  gross_weight_kg numeric(10,3) not null,
  order_item_ids uuid[] not null,
  shipping_mark text not null,
  guangzhou_tracking_number text,
  label_file_path text,
  status text not null default 'packed',
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.shipping_rates (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  bdt_per_kg numeric(12,2) not null,
  active boolean not null default true
);

create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  cny_to_bdt numeric(10,4) not null,
  source text not null default 'admin',
  effective_on date not null,
  created_by uuid references public.profiles(id),
  unique(effective_on, source)
);

create table public.profit_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text,
  percentage numeric(6,4),
  fixed_bdt numeric(12,2),
  active boolean not null default true
);

create table public.category_rules (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  default_weight_kg numeric(10,3) not null,
  restricted boolean not null default false,
  notes text
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.integration_logs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  request_payload jsonb,
  response_payload jsonb,
  status text not null,
  error_message text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.product_links enable row level security;
alter table public.order_groups enable row level security;
alter table public.estimates enable row level security;
alter table public.order_items enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.provider_orders enable row level security;
alter table public.parcels enable row level security;
alter table public.cartons enable row level security;
alter table public.notifications enable row level security;

create function public.current_user_role()
returns public.user_role
language sql
security definer
stable
as $$
  select role from public.profiles where id = auth.uid()
$$;

create policy "users can read own profile" on public.profiles for select using (id = auth.uid() or public.current_user_role() in ('admin', 'super_admin'));
create policy "admins manage profiles" on public.profiles for all using (public.current_user_role() in ('admin', 'super_admin'));
create policy "clients read own client row" on public.clients for select using (profile_id = auth.uid() or public.current_user_role() in ('admin', 'super_admin'));
create policy "admins manage clients" on public.clients for all using (public.current_user_role() in ('admin', 'super_admin'));
create policy "admins read all product links" on public.product_links for select using (public.current_user_role() in ('admin', 'super_admin', 'staff_receiver', 'staff_packer'));
create policy "authenticated create product links" on public.product_links for insert with check (auth.uid() is not null);
create policy "clients read own estimates" on public.estimates for select using (client_id in (select id from public.clients where profile_id = auth.uid()) or public.current_user_role() in ('admin', 'super_admin'));
create policy "clients read own orders" on public.order_items for select using (client_id in (select id from public.clients where profile_id = auth.uid()) or public.current_user_role() in ('admin', 'super_admin', 'staff_receiver', 'staff_packer'));
create policy "clients read own groups" on public.order_groups for select using (client_id in (select id from public.clients where profile_id = auth.uid()) or public.current_user_role() in ('admin', 'super_admin'));
create policy "clients read own wallet" on public.wallet_transactions for select using (client_id in (select id from public.clients where profile_id = auth.uid()) or public.current_user_role() in ('admin', 'super_admin'));
create policy "staff read parcels" on public.parcels for select using (public.current_user_role() in ('staff_receiver', 'staff_packer', 'admin', 'super_admin'));
create policy "staff read cartons" on public.cartons for select using (public.current_user_role() in ('staff_packer', 'admin', 'super_admin'));
create policy "users read own notifications" on public.notifications for select using (profile_id = auth.uid() or public.current_user_role() in ('admin', 'super_admin'));
