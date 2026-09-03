-- Keep the privileged client order aggregation outside the exposed API schema
-- and cover the new purchase-commitment audit foreign key.
begin;

create index order_items_wallet_committed_by_idx
on public.order_items (wallet_committed_by)
where wallet_committed_by is not null;

alter function public.get_client_order_cards() set schema private;

revoke all on function private.get_client_order_cards() from public, anon;
grant execute on function private.get_client_order_cards() to authenticated, service_role;

create function public.get_client_order_cards()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_client_order_cards();
$$;

revoke all on function public.get_client_order_cards() from public, anon;
grant execute on function public.get_client_order_cards() to authenticated, service_role;

commit;
