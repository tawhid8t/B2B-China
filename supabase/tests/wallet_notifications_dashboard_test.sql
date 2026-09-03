begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_column('public', 'notifications', 'event_type', 'notifications identify wallet/payment event type');
select has_trigger('public', 'notifications', 'notifications_classify_event', 'legacy producers are classified');
select has_trigger('public', 'order_items', 'order_items_notify_wallet_shortfall', 'uncovered orders notify recipients');
select has_trigger('public', 'wallet_transactions', 'wallet_transactions_notify_ledger_event', 'wallet releases and corrections notify clients');
select has_function('public', 'get_admin_financial_dashboard', array[]::text[], 'protected financial dashboard RPC exists');
select has_function('public', 'get_wallet_reconciliation', array[]::text[], 'protected reconciliation RPC exists');

insert into auth.users (id, email, raw_user_meta_data) values
  ('19000000-0000-0000-0000-000000000001', 'notify-admin@example.test', '{"full_name":"Notify Admin"}'),
  ('19000000-0000-0000-0000-000000000002', 'notify-client@example.test', '{"full_name":"Notify Client"}'),
  ('19000000-0000-0000-0000-000000000003', 'notify-other@example.test', '{"full_name":"Other Client"}'),
  ('19000000-0000-0000-0000-000000000004', 'notify-staff@example.test', '{"full_name":"Notify Staff"}');
update public.profiles set role = 'admin' where id = '19000000-0000-0000-0000-000000000001';
update public.profiles set role = 'staff_receiver' where id = '19000000-0000-0000-0000-000000000004';
update public.clients set id = '29000000-0000-0000-0000-000000000001', business_name = 'Notify Client'
where profile_id = '19000000-0000-0000-0000-000000000002';
update public.clients set id = '29000000-0000-0000-0000-000000000002', business_name = 'Other Client'
where profile_id = '19000000-0000-0000-0000-000000000003';

set local role authenticated;
select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_wallet_adjustment('29000000-0000-0000-0000-000000000001',100,19.2,'opening correction')$$,
  'admin adjustment posts atomically'
);
select is((select count(*)::integer from public.get_admin_financial_dashboard()), 1, 'admin reads one protected financial summary');
select is((select total_available_cny from public.get_admin_financial_dashboard()), 100.00::numeric, 'dashboard uses persisted wallet arithmetic');
select is((select count(*)::integer from public.notifications), 0, 'admin cannot browse a client notification');

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.notifications), 1, 'client reads the notification addressed to them');
select is((select event_type from public.notifications limit 1), 'wallet_corrected', 'adjustment notification has the correct event type');
select lives_ok($$update public.notifications set read_at = now()$$, 'client can mark their own notification read');
select throws_ok(
  $$update public.notifications set title = 'changed'$$,
  '42501', null, 'recipient cannot alter immutable notification content'
);
select throws_ok(
  $$select * from public.get_admin_financial_dashboard()$$,
  '42501', 'admin access required', 'client cannot read aggregate client balances'
);

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.notifications), 0, 'another client cannot read the notification');

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select * from public.get_admin_financial_dashboard()$$,
  '42501', 'admin access required', 'warehouse staff cannot read financial summaries'
);
select throws_ok(
  $$select * from public.get_wallet_reconciliation()$$,
  '42501', 'admin access required', 'warehouse staff cannot run financial reconciliation'
);

select set_config('request.jwt.claim.sub', '19000000-0000-0000-0000-000000000001', true);
select is(
  (select negative_available_wallets + approved_proofs_without_one_credit + overcorrected_transactions + invalid_order_coverage from public.get_wallet_reconciliation()),
  0::bigint,
  'financial reconciliation reports no anomaly in the tested ledger'
);

select * from finish();
rollback;
