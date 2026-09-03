begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('16000000-0000-0000-0000-000000000001', 'phase5-admin@example.test', '{"full_name":"Phase 5 Admin"}'),
  ('16000000-0000-0000-0000-000000000002', 'phase5-client@example.test', '{"full_name":"Phase 5 Client"}');
update public.profiles set role = 'admin' where id = '16000000-0000-0000-0000-000000000001';

insert into public.clients (id, profile_id, business_name)
values ('26000000-0000-0000-0000-000000000001', '16000000-0000-0000-0000-000000000002', 'Phase 5 Client');
insert into public.product_links (id, original_url, provider, provider_item_id, title)
values ('36000000-0000-0000-0000-000000000001', 'https://example.test/phase5', 'test', 'phase5-item', 'Phase 5 item');
insert into public.product_skus (id, product_link_id, provider_sku_id, label, price_cny)
values
  ('46000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001', 'phase5-sku-1', 'First', 4),
  ('46000000-0000-0000-0000-000000000002', '36000000-0000-0000-0000-000000000001', 'phase5-sku-2', 'Second', 5);
insert into public.payment_proofs (id, client_id, amount_bdt, paid_at)
values ('56000000-0000-0000-0000-000000000001', '26000000-0000-0000-0000-000000000001', 115.20, current_date);

select set_config('request.jwt.claim.sub', '16000000-0000-0000-0000-000000000001', true);
set local role authenticated;
select public.approve_payment_proof('56000000-0000-0000-0000-000000000001', 115.20, 19.2, 'phase 5 test credit');

set local role service_role;
create temp table confirmed as
select * from public.confirm_multi_sku_order(
  '16000000-0000-0000-0000-000000000002', 'client',
  '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001',
  '[{"skuId":"46000000-0000-0000-0000-000000000001","quantity":1},{"skuId":"46000000-0000-0000-0000-000000000002","quantity":1}]',
  1, 'General goods', 600, 'phase5-confirm-key'
);

select is((select count(*)::integer from confirmed), 2, 'direct confirmation creates both order lines');
select is((select sum(wallet_reserved_cny) from public.order_items where id in (select order_item_id from confirmed)), 6.00::numeric, 'direct confirmation reserves only available funds');
select is((select sum(wallet_uncovered_cny) from public.order_items where id in (select order_item_id from confirmed)), 3.00::numeric, 'direct confirmation persists the uncovered amount');
select is((select count(*)::integer from public.wallet_transactions where order_item_id in (select order_item_id from confirmed) and transaction_type = 'reservation'), 2, 'direct confirmation posts reservations');
select is((select count(*)::integer from public.wallet_transactions where order_item_id in (select order_item_id from confirmed) and transaction_type = 'order_debit'), 0, 'confirmation does not debit the wallet');
select ok((select bool_and(running_balance_cny >= 0) from public.wallet_transactions where client_id = '26000000-0000-0000-0000-000000000001'), 'wallet never becomes negative');
select is(public.get_client_wallet_balance('26000000-0000-0000-0000-000000000001'), 0.00::numeric, 'reservations consume only available funds');
select is((select count(*)::integer from confirmed where pending_payment), 1, 'only the partially covered line warns about pending payment');

create temp table confirmation_retry as
select * from public.confirm_multi_sku_order(
  '16000000-0000-0000-0000-000000000002', 'client',
  '26000000-0000-0000-0000-000000000001', '36000000-0000-0000-0000-000000000001',
  '[{"skuId":"46000000-0000-0000-0000-000000000001","quantity":1},{"skuId":"46000000-0000-0000-0000-000000000002","quantity":1}]',
  1, 'General goods', 600, 'phase5-confirm-key'
);
select is((select count(*)::integer from public.order_items where id in (select order_item_id from confirmation_retry)), 2, 'confirmation retry returns original orders');
select is((select count(*)::integer from public.wallet_transactions where order_item_id in (select order_item_id from confirmed) and transaction_type = 'reservation'), 2, 'confirmation retry creates no duplicate reservations');

set local role authenticated;
select public.change_order_status((select order_item_id from confirmed order by product_cost_cny limit 1), 'cancelled', 'client cancelled before purchase');
select is((select count(*)::integer from public.wallet_transactions where order_item_id = (select order_item_id from confirmed order by product_cost_cny limit 1) and transaction_type = 'reservation_release'), 1, 'cancellation releases its active reservation');
select is(public.get_client_wallet_balance('26000000-0000-0000-0000-000000000001'), 4.00::numeric, 'cancellation restores available wallet funds');

select public.change_order_status((select order_item_id from confirmed order by product_cost_cny desc limit 1), 'confirmed', 'approved');
select public.change_order_status((select order_item_id from confirmed order by product_cost_cny desc limit 1), 'queued_for_purchase', 'queued');
select throws_ok(
  $$select * from public.sync_provider_order_and_commit_wallet((select order_item_id from confirmed order by product_cost_cny desc limit 1), 'test', 'phase5-provider-1', 7, null, 'paid', '{}', 20)$$,
  '22023', 'exchange-rate override reason is required',
  'adjusted purchase rate requires an audit reason'
);

create temp table committed as
select * from public.sync_provider_order_and_commit_wallet(
  (select order_item_id from confirmed order by product_cost_cny desc limit 1),
  'test', 'phase5-provider-1', 7, null, 'paid', '{"rateAdjustmentReason":"supplier settlement rate corrected by admin"}', 20
);
select is((select debited_amount_cny from committed), 2.00::numeric, 'purchase commitment debits only wallet-covered funds');
select is((select uncovered_amount_cny from committed), 5.00::numeric, 'purchase commitment prices and persists actual uncovered cost');
select is((select wallet_rate_cny_to_bdt from public.order_items where id = (select order_item_id from confirmed order by product_cost_cny desc limit 1)), 20.0000::numeric, 'audited adjusted rate is persisted');
select is((select wallet_rate_adjustment_reason from public.order_items where id = (select order_item_id from confirmed order by product_cost_cny desc limit 1)), 'supplier settlement rate corrected by admin', 'rate adjustment reason is persisted');

select * from finish();
rollback;
