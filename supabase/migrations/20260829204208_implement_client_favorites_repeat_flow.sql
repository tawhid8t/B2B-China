begin;

create table public.client_favorites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete restrict,
  source_order_item_id uuid not null references public.order_items(id) on delete restrict,
  source_product_link_id uuid not null references public.product_links(id) on delete restrict,
  source_product_sku_id uuid references public.product_skus(id) on delete restrict,
  preferred_provider_sku_id text,
  preferred_variant_attributes jsonb not null default '{}'::jsonb,
  preferred_variant_label text,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  archived_by uuid references public.profiles(id) on delete restrict,
  unique (client_id, source_order_item_id)
);

create index client_favorites_client_status_idx on public.client_favorites(client_id, status, created_at desc);
alter table public.client_favorites enable row level security;
revoke all on table public.client_favorites from public, anon, authenticated;

create or replace function public.create_client_favorite(p_order_item_id uuid)
returns public.client_favorites
language plpgsql security definer set search_path = ''
as $$
declare v_client_id uuid; v_order public.order_items%rowtype; v_favorite public.client_favorites%rowtype;
begin
  if auth.uid() is null or public.current_user_role() <> 'client' then raise exception using errcode='42501', message='client role required'; end if;
  select id into v_client_id from public.clients where profile_id = auth.uid();
  select * into v_order from public.order_items where id=p_order_item_id and client_id=v_client_id;
  if not found or v_order.status in ('cancelled','exception') or v_order.status = 'pending_admin_review' then raise exception using errcode='P0002', message='eligible order not found'; end if;
  insert into public.client_favorites(client_id, source_order_item_id, source_product_link_id, source_product_sku_id)
  values (v_client_id, v_order.id, v_order.product_link_id, v_order.product_sku_id)
  on conflict (client_id, source_order_item_id) do update set status='active', archived_at=null, archived_by=null
  returning * into v_favorite;
  return v_favorite;
end; $$;

create or replace function public.archive_client_favorite(p_favorite_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_client_id uuid; v_count integer;
begin
  if auth.uid() is null or public.current_user_role() <> 'client' then raise exception using errcode='42501', message='client role required'; end if;
  select id into v_client_id from public.clients where profile_id=auth.uid();
  update public.client_favorites set status='archived', archived_at=now(), archived_by=auth.uid() where id=p_favorite_id and client_id=v_client_id and status='active';
  get diagnostics v_count = row_count; return v_count=1;
end; $$;

revoke all on function public.create_client_favorite(uuid), public.archive_client_favorite(uuid) from public, anon;
grant execute on function public.create_client_favorite(uuid), public.archive_client_favorite(uuid) to authenticated;
commit;
