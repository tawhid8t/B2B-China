begin;

create extension if not exists pgtap with schema extensions;
select plan(26);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-0000-0000-000000000001', 'admin@example.test', '{"full_name":"MVP Admin","role":"super_admin"}'),
  ('10000000-0000-0000-0000-000000000002', 'client@example.test', '{"full_name":"MVP Client"}');

select is(
  (select role::text from public.profiles where id = '10000000-0000-0000-0000-000000000001'),
  'client',
  'signup creates a client profile and ignores role metadata'
);

update public.profiles set role = 'admin'
where id = '10000000-0000-0000-0000-000000000001';

insert into public.clients (id, profile_id, business_name)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'Test Client');

insert into public.product_links (id, original_url, provider, provider_item_id, title)
values (
  '30000000-0000-0000-0000-000000000001',
  'https://example.test/items/1',
  'test-provider',
  'test-item-1',
  'Test item'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);
set local role authenticated;

select is(public.current_user_role()::text, 'admin', 'current_user_role derives the authenticated role');

create temp table test_group as
select (public.create_or_get_active_order_group('20000000-0000-0000-0000-000000000001')).id as id;

select is(
  (public.create_or_get_active_order_group('20000000-0000-0000-0000-000000000001')).id,
  (select id from test_group),
  'the active order group is reused'
);

insert into public.order_items (
  id, client_id, group_id, product_link_id, quantity, cny_price, estimated_total_bdt, status
)
select
  '40000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  id,
  '30000000-0000-0000-0000-000000000001',
  1,
  10,
  120,
  'pending_admin_review'
from test_group;

select is(
  (select estimated_total_bdt from public.order_groups where id = (select id from test_group)),
  120.00::numeric,
  'group total is derived after item insert'
);

select is(
  (select count(*)::integer from public.order_status_events where order_item_id = '40000000-0000-0000-0000-000000000001'),
  1,
  'order creation writes initial status history'
);

select public.change_order_status(
  '40000000-0000-0000-0000-000000000001',
  'confirmed',
  'admin confirmed test order'
);

select is(
  (select status::text from public.order_items where id = '40000000-0000-0000-0000-000000000001'),
  'confirmed',
  'a valid order transition is applied'
);

select is(
  (select reason
   from public.order_status_events
   where order_item_id = '40000000-0000-0000-0000-000000000001'
     and from_status = 'pending_admin_review'
     and to_status = 'confirmed'),
  'admin confirmed test order',
  'the transition reason is retained'
);

select ok(
  exists (select 1 from public.audit_logs where entity_id = '40000000-0000-0000-0000-000000000001' and action = 'order_status_changed'),
  'the order transition is audited'
);

select throws_ok(
  $$select public.change_order_status('40000000-0000-0000-0000-000000000001', 'completed')$$,
  '23514',
  'invalid or unauthorized order status transition',
  'invalid status skips are rejected'
);

select public.change_order_status('40000000-0000-0000-0000-000000000001', 'exception', 'provider mismatch');
select public.change_order_status('40000000-0000-0000-0000-000000000001', 'confirmed', 'exception resolved');

select is(
  (select status::text from public.order_items where id = '40000000-0000-0000-0000-000000000001'),
  'confirmed',
  'exception resolves to the prior active status'
);

insert into public.payment_proofs (id, client_id, amount_bdt, paid_at, status)
values ('50000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 120, current_date, 'pending');

create temp table first_approval as
select * from public.approve_payment_proof(
  '50000000-0000-0000-0000-000000000001', 120, 12, 'receipt verified'
);

select is((select credited_amount_cny from first_approval), 10.00::numeric, 'payment approval computes CNY credit');
select is((select status::text from public.payment_proofs where id = '50000000-0000-0000-0000-000000000001'), 'approved', 'payment proof is approved');
select is(public.get_client_wallet_balance('20000000-0000-0000-0000-000000000001'), 10.00::numeric, 'balance is derived from posted credit');

create temp table second_approval as
select * from public.approve_payment_proof(
  '50000000-0000-0000-0000-000000000001', 120, 12, 'idempotent retry'
);

select is(
  (select wallet_transaction_id from second_approval),
  (select wallet_transaction_id from first_approval),
  'payment approval retry returns the existing credit'
);

select is(
  (select count(*)::integer from public.wallet_transactions where payment_proof_id = '50000000-0000-0000-0000-000000000001'),
  1,
  'payment approval retry does not duplicate credit'
);

select throws_ok(
  $$select public.post_wallet_transaction('20000000-0000-0000-0000-000000000001', 'reservation', -12, -1, 12)$$,
  '22023',
  'order item is required for wallet debit or reservation',
  'wallet reservation requires an order reference'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select throws_ok(
  $$select public.post_wallet_transaction(
      p_client_id => '20000000-0000-0000-0000-000000000001',
      p_transaction_type => 'adjustment',
      p_amount_bdt => 12,
      p_amount_cny => 1,
      p_cny_to_bdt_rate => 12,
      p_notes => 'unauthorized adjustment'
    )$$,
  '42501',
  'admin role required',
  'clients cannot post wallet adjustments'
);

select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

create temp table debit_result as
select (public.post_wallet_transaction(
  '20000000-0000-0000-0000-000000000001',
  'order_debit',
  -60,
  -5,
  12,
  null,
  '40000000-0000-0000-0000-000000000001'
)).id as id;

select is(public.get_client_wallet_balance('20000000-0000-0000-0000-000000000001'), 5.00::numeric, 'explicit debit lowers the derived balance');

select throws_ok(
  $$select public.post_wallet_transaction(
      '20000000-0000-0000-0000-000000000001', 'order_debit', -72, -6, 12,
      null, '40000000-0000-0000-0000-000000000001'
    )$$,
  '23514',
  'wallet transaction exceeds available balance',
  'a debit cannot overdraw the wallet'
);

select throws_ok(
  $$update public.wallet_transactions set notes = 'tampered' where id = (select id from debit_result)$$,
  '55000',
  'finalized wallet transactions are immutable; create an adjustment row',
  'posted wallet entries remain immutable'
);

insert into public.order_items (
  client_id, group_id, product_link_id, quantity, cny_price, estimated_total_bdt, status
)
select
  '20000000-0000-0000-0000-000000000001',
  (select id from test_group),
  '30000000-0000-0000-0000-000000000001',
  1,
  1,
  1,
  'completed'
from generate_series(1, 40);

select is((select fulfilled_item_count from public.order_groups where id = (select id from test_group)), 40, 'completed items derive fulfilled count');
select is((select status::text from public.order_groups where id = (select id from test_group)), 'full', 'group closes at the fulfilled-item limit');
select is((select estimated_total_bdt from public.order_groups where id = (select id from test_group)), 160.00::numeric, 'derived group totals remain correct at closure');

create temp table replacement_group as
select (public.create_or_get_active_order_group('20000000-0000-0000-0000-000000000001')).id as id;

select isnt((select id from replacement_group), (select id from test_group), 'a new active group is created after closure');

create temp table manual_audit as
select (public.write_audit_log(
  'verification',
  '20000000-0000-0000-0000-000000000001',
  'verified',
  null,
  '{"result":"pass"}',
  'pgTAP verification'
)).id as id;

select is(
  (select actor_id from public.audit_logs where id = (select id from manual_audit)),
  '10000000-0000-0000-0000-000000000001'::uuid,
  'audit actor is derived from the session'
);

reset role;

select throws_ok(
  $$delete from public.audit_logs where id = (select id from manual_audit)$$,
  '55000',
  'audit_logs is append-only; create a new event or correction row',
  'audit records remain append-only'
);

select * from finish();
rollback;
