-- The public wallet RPC is security-invoker and performs its own admin role,
-- amount, linkage, and balance validation before inserting. Restore the grant
-- and matching admin-only RLS policy required by that RPC.
grant insert on public.wallet_transactions to authenticated;

create policy wallet_transactions_admin_insert
on public.wallet_transactions for insert to authenticated
with check ((select public.current_user_role()) in ('admin', 'super_admin'));
