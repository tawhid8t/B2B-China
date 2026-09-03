begin;
create table public.favorite_refreshes (
  id uuid primary key default gen_random_uuid(), favorite_id uuid not null references public.client_favorites(id) on delete restrict,
  client_id uuid not null references public.clients(id) on delete restrict, status text not null check (status in ('resolved','unavailable','manual_review_required','failed')),
  resolved_product_link_id uuid references public.product_links(id) on delete restrict, provider_sku_match_status text,
  resolved_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now()
);
create index favorite_refreshes_client_created_idx on public.favorite_refreshes(client_id, created_at desc);
alter table public.favorite_refreshes enable row level security;
revoke all on table public.favorite_refreshes from public, anon, authenticated;
commit;
