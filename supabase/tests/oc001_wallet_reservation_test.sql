begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email, raw_user_meta_data) values
  ('11000000-0000-0000-0000-000000000001', 'oc001-admin@example.test', '{"full_name":"OC001 Admin"}'),
  ('11000000-0000-0000-0000-000000000002', 'oc001-client@example.test', '{"full_name":"OC001 Client"}');

update public.profiles set role = 'admin'
where id = '11000000-0000-0000-0000-000000000001';

insert into public.clients (id, profile_id, business_name)
values ('21000000-0000-0000-0000-000000000001', '11000000-0000-0000-0000-000000000002', 'OC001 Client');

insert into public.product_links (id, original_url, provider, provider_item_id, title)
values ('31000000-0000-0000-0000-000000000001', 'https://example.test/oc001', 'test', 'oc001-item', 'OC001 item');

insert into public.estimates (
  id, client_id, product_link_id, sku_id, quantity, breakdown, total_bdt,
  valid_until, status, unit_price_cny, domestic_delivery_cny,
  estimated_total_weight_kg, exchange_rate_cny_to_bdt,
  category_shipping_bdt, china_to_guangzhou_bdt, profit_bdt
) values
  ('41000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'sku-1', 1, '{}', 120, now() + interval '1 day', 'sent_to_client', 10, 0, 1, 12, 0, 0, 0),
  ('41000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'sku-2', 1, '{}', 48, now() + interval '1 day', 'sent_to_client', 4, 0, 1, 12, 0, 0, 0),
  ('41000000-0000-0000-0000-000000000003', '21000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'sku-3', 1, '{}', 24, now() + interval '1 day', 'sent_to_client', 2, 0, 1, 12, 0, 0, 0);

insert into public.payment_proofs (id, client_id, amount_bdt, paid_at) values
  ('51000000-0000-0000-0000-000000000001', '21000000-0000-0000-0000-000000000001', 60, current_date),
  ('51000000-0000-0000-0000-000000000002', '21000000-0000-0000-0000-000000000001', 24, current_date);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.approve_payment_proof('51000000-0000-0000-0000-000000000001', 60, 12, 'initial wallet credit');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
create temp table first_accept as
select * from public.accept_estimate_with_reservation(
  '41000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001'
);

select is((select status::text from public.estimates where id = '41000000-0000-0000-0000-000000000001'), 'converted_to_order', 'acceptance converts the estimate');
select is((select wallet_reservation_status from first_accept), 'reserved_or_partial', 'partial balance returns a warning status');
select is((select reserved_amount_cny from first_accept), 5.00::numeric, 'only available balance is reserved');
select is((select uncovered_amount_cny from first_accept), 5.00::numeric, 'uncovered estimate amount is retained');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from first_accept) and transaction_type = 'reservation'), 1, 'acceptance appends one reservation');
select is(public.get_client_wallet_balance('21000000-0000-0000-0000-000000000001'), 0.00::numeric, 'reservation reduces available balance without a debit');

create temp table repeated_accept as
select * from public.accept_estimate_with_reservation(
  '41000000-0000-0000-0000-000000000001',
  '21000000-0000-0000-0000-000000000001'
);

select is((select order_item_id from repeated_accept), (select order_item_id from first_accept), 'acceptance retry returns the same order');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from first_accept) and transaction_type = 'reservation'), 1, 'acceptance retry does not duplicate reservation');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select public.change_order_status((select order_item_id from first_accept), 'confirmed', 'approved');
select public.change_order_status((select order_item_id from first_accept), 'queued_for_purchase', 'queued');

create temp table first_sync as
select * from public.sync_provider_order_and_commit_wallet(
  (select order_item_id from first_accept),
  'test',
  'oc001-provider-order-1',
  12,
  null,
  'paid',
  '{}',
  null
);

select is((select order_item_status::text from first_sync), 'purchased', 'provider commitment marks the order purchased');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from first_accept) and transaction_type = 'reservation_release'), 1, 'commitment releases the reservation entry');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from first_accept) and transaction_type = 'order_debit'), 1, 'commitment appends the actual debit');
select is((select amount_cny from public.wallet_transactions where order_item_id = (select order_item_id from first_accept) and transaction_type = 'order_debit'), -5.00::numeric, 'debit uses only the reserved wallet amount');
select is((select wallet_uncovered_cny from public.order_items where id = (select order_item_id from first_accept)), 7.00::numeric, 'actual uncovered purchase amount is retained');
select is(public.get_client_wallet_balance('21000000-0000-0000-0000-000000000001'), 0.00::numeric, 'reservation conversion preserves the correct ledger balance');

create temp table repeated_sync as
select * from public.sync_provider_order_and_commit_wallet(
  (select order_item_id from first_accept),
  'test',
  'oc001-provider-order-1',
  12,
  null,
  'paid',
  '{}',
  null
);

select is((select provider_order_record_id from repeated_sync), (select provider_order_record_id from first_sync), 'provider sync retry returns the same provider order');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from first_accept) and transaction_type = 'order_debit'), 1, 'provider sync retry does not duplicate debit');

select throws_ok(
  $$update public.wallet_transactions set notes = 'tampered' where id = (select reservation_transaction_id from first_accept)$$,
  '55000',
  'finalized wallet transactions are immutable; create an adjustment row',
  'reservation ledger rows remain append-only'
);

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);
create temp table zero_balance_accept as
select * from public.accept_estimate_with_reservation(
  '41000000-0000-0000-0000-000000000002',
  '21000000-0000-0000-0000-000000000001'
);

select is((select wallet_reservation_status from zero_balance_accept), 'insufficient_balance', 'zero balance warns but does not block acceptance');
select ok((select order_item_id is not null from zero_balance_accept), 'insufficient balance still creates the order');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from zero_balance_accept) and transaction_type = 'reservation'), 0, 'zero available balance creates no zero-value ledger row');
select is((select uncovered_amount_cny from zero_balance_accept), 4.00::numeric, 'full uncovered amount is recorded');

select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000001', true);
select public.approve_payment_proof('51000000-0000-0000-0000-000000000002', 24, 12, 'release test credit');
select set_config('request.jwt.claim.sub', '11000000-0000-0000-0000-000000000002', true);

create temp table releasable_accept as
select * from public.accept_estimate_with_reservation(
  '41000000-0000-0000-0000-000000000003',
  '21000000-0000-0000-0000-000000000001'
);

select is(public.get_client_wallet_balance('21000000-0000-0000-0000-000000000001'), 0.00::numeric, 'full reservation holds available balance');
select public.change_order_status((select order_item_id from releasable_accept), 'cancelled', 'client rejected accepted estimate');
select is((select status::text from public.order_items where id = (select order_item_id from releasable_accept)), 'cancelled', 'client rejection cancels the pending order');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from releasable_accept) and transaction_type = 'reservation_release'), 1, 'rejection appends a reservation release');
select is(public.get_client_wallet_balance('21000000-0000-0000-0000-000000000001'), 2.00::numeric, 'reservation release restores available balance');

select * from finish();
rollback;
