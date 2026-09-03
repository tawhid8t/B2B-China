begin;

create extension if not exists pgtap with schema extensions;
select plan(40);

insert into auth.users (id, email, raw_user_meta_data)
values
  ('71000000-0000-0000-0000-000000000001', 'rls-client-a@example.test', '{"full_name":"RLS Client A"}'),
  ('72000000-0000-0000-0000-000000000002', 'rls-client-b@example.test', '{"full_name":"RLS Client B"}'),
  ('73000000-0000-0000-0000-000000000003', 'rls-receiver-a@example.test', '{"full_name":"RLS Receiver A"}'),
  ('73000000-0000-0000-0000-000000000004', 'rls-receiver-b@example.test', '{"full_name":"RLS Receiver B"}'),
  ('74000000-0000-0000-0000-000000000005', 'rls-packer@example.test', '{"full_name":"RLS Packer"}'),
  ('75000000-0000-0000-0000-000000000006', 'rls-admin@example.test', '{"full_name":"RLS Admin"}'),
  ('76000000-0000-0000-0000-000000000007', 'rls-owner@example.test', '{"full_name":"RLS Owner"}');

update public.profiles
set role = case id
  when '73000000-0000-0000-0000-000000000003' then 'staff_receiver'::public.user_role
  when '73000000-0000-0000-0000-000000000004' then 'staff_receiver'::public.user_role
  when '74000000-0000-0000-0000-000000000005' then 'staff_packer'::public.user_role
  when '75000000-0000-0000-0000-000000000006' then 'admin'::public.user_role
  when '76000000-0000-0000-0000-000000000007' then 'super_admin'::public.user_role
  else role
end
where id in (
  '73000000-0000-0000-0000-000000000003',
  '73000000-0000-0000-0000-000000000004',
  '74000000-0000-0000-0000-000000000005',
  '75000000-0000-0000-0000-000000000006',
  '76000000-0000-0000-0000-000000000007'
);

insert into public.clients (id, profile_id, business_name)
values
  ('81000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'RLS Business A'),
  ('82000000-0000-0000-0000-000000000002', '72000000-0000-0000-0000-000000000002', 'RLS Business B');

insert into public.product_links (id, original_url, provider, provider_item_id, title, images)
values (
  '83000000-0000-0000-0000-000000000001',
  'https://example.test/rls-product',
  'test-provider',
  'rls-product',
  'RLS Product',
  array['product.jpg']
);

insert into public.order_groups (id, client_id, group_code)
values
  ('84000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 'RLS-GROUP-A'),
  ('85000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 'RLS-GROUP-B');

insert into public.order_items (
  id, client_id, group_id, product_link_id, quantity, cny_price, category, status
)
values
  ('86000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '84000000-0000-0000-0000-000000000001', '83000000-0000-0000-0000-000000000001', 2, 10, 'apparel', 'received_china'),
  ('87000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', '85000000-0000-0000-0000-000000000002', '83000000-0000-0000-0000-000000000001', 3, 12, 'apparel', 'received_china');

insert into public.payment_proofs (id, client_id, amount_bdt, paid_at, status)
values
  ('88000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', 120, current_date, 'approved'),
  ('89000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', 240, current_date, 'approved');

insert into public.wallet_transactions (
  id, client_id, payment_proof_id, transaction_type, amount_bdt, amount_cny,
  cny_to_bdt_rate, running_balance_cny, status
)
values
  ('90000000-0000-0000-0000-000000000001', '81000000-0000-0000-0000-000000000001', '88000000-0000-0000-0000-000000000001', 'advance_credit', 120, 10, 12, 10, 'posted'),
  ('90000000-0000-0000-0000-000000000002', '82000000-0000-0000-0000-000000000002', '89000000-0000-0000-0000-000000000002', 'advance_credit', 240, 20, 12, 20, 'posted');

insert into public.parcels (
  id, order_item_id, tracking_number, expected_pieces, assigned_staff_id, status
)
values
  ('92000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', 'RLS-TRACK-A', 2, '73000000-0000-0000-0000-000000000003', 'received'),
  ('93000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000002', 'RLS-TRACK-B', 3, '73000000-0000-0000-0000-000000000004', 'received');

insert into public.parcel_items (
  id, parcel_id, order_item_id, expected_pieces, received_pieces, weight_kg,
  qc_status, checked_by, checked_at
)
values
  ('94000000-0000-0000-0000-000000000001', '92000000-0000-0000-0000-000000000001', '86000000-0000-0000-0000-000000000001', 2, 2, 1.2, 'pass', '73000000-0000-0000-0000-000000000003', now()),
  ('95000000-0000-0000-0000-000000000002', '93000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000002', 3, 3, 1.8, 'pass', '73000000-0000-0000-0000-000000000004', now());

insert into public.cartons (
  id, client_id, carton_code, category, shipping_mark, net_weight_kg,
  gross_weight_kg, status, created_by
)
values (
  '96000000-0000-0000-0000-000000000001',
  '82000000-0000-0000-0000-000000000002',
  'RLS-CARTON-B',
  'apparel',
  'RLS-B',
  1.8,
  2.0,
  'packed',
  '74000000-0000-0000-0000-000000000005'
);

insert into public.exchange_rates (id, cny_to_bdt, source, effective_on, created_by)
values ('98000000-0000-0000-0000-000000000001', 12, 'rls-test', current_date, '76000000-0000-0000-0000-000000000007');

insert into public.profit_rules (id, name, percentage, active)
values ('99000000-0000-0000-0000-000000000001', 'RLS Profit', 0.10, true);

set local role authenticated;

-- Client A: own rows are visible; client B rows are isolated.
select set_config('request.jwt.claim.sub', '71000000-0000-0000-0000-000000000001', true);
select is(public.current_user_role()::text, 'client', 'client role resolves from the protected profile');
select is((select count(*)::integer from public.clients), 1, 'client sees only one client record');
select is((select count(*)::integer from public.clients where id = '82000000-0000-0000-0000-000000000002'), 0, 'client cannot read another client record');
select is((select count(*)::integer from public.order_items), 1, 'client sees only own orders');
select is((select count(*)::integer from public.order_items where id = '87000000-0000-0000-0000-000000000002'), 0, 'client cannot read another client order');
select is((select count(*)::integer from public.order_groups), 1, 'client sees only own groups');
select is((select count(*)::integer from public.payment_proofs), 1, 'client sees only own payment proofs');
select is((select count(*)::integer from public.payment_proofs where client_id = '82000000-0000-0000-0000-000000000002'), 0, 'client cannot read another client payment proof');
select is((select count(*)::integer from public.wallet_transactions), 1, 'client sees only own wallet entries');
select is((select count(*)::integer from public.wallet_transactions where client_id = '82000000-0000-0000-0000-000000000002'), 0, 'client cannot read another client wallet');
select is((select count(*)::integer from public.cartons), 0, 'client cannot read another client carton');
select is((select count(*)::integer from public.product_links), 0, 'client cannot read raw provider snapshots directly');
select throws_ok(
  $$select * from public.get_warehouse_receiving_queue()$$,
  '42501',
  'receiving access required',
  'client cannot call the receiving queue RPC'
);

-- Receiver A: only assigned receiving data, never business finance or raw orders.
select set_config('request.jwt.claim.sub', '73000000-0000-0000-0000-000000000003', true);
select is((select count(*)::integer from public.parcels), 1, 'receiver sees only self-assigned parcels');
select is((select count(*)::integer from public.parcels where id = '93000000-0000-0000-0000-000000000002'), 0, 'receiver cannot see another receiver parcel');
select is((select count(*)::integer from public.parcel_items), 1, 'receiver sees only items for accessible parcels');
select is((select count(*)::integer from public.order_items), 0, 'receiver cannot read raw order rows');
select is((select count(*)::integer from public.clients), 0, 'receiver cannot read client table rows');
select is((select count(*)::integer from public.payment_proofs), 0, 'receiver cannot read payment proofs');
select is((select count(*)::integer from public.wallet_transactions), 0, 'receiver cannot read wallet entries');
select is((select count(*)::integer from public.profit_rules), 0, 'receiver cannot read profit rules');
select is((select count(*)::integer from public.exchange_rates), 0, 'receiver cannot read exchange-rate history');
select is((select count(*)::integer from public.get_warehouse_receiving_queue()), 1, 'receiver gets only the limited assigned receiving queue');
select throws_ok(
  $$select * from public.get_warehouse_packing_queue()$$,
  '42501',
  'packing access required',
  'receiver cannot call the packing queue RPC'
);

-- Packer: packing data is available only through cartons and the limited queue.
select set_config('request.jwt.claim.sub', '74000000-0000-0000-0000-000000000005', true);
select is((select count(*)::integer from public.parcels), 0, 'packer cannot read parcel rows directly');
select is((select count(*)::integer from public.parcel_items), 0, 'packer cannot read receiving rows directly');
select is((select count(*)::integer from public.order_items), 0, 'packer cannot read raw order rows');
select is((select count(*)::integer from public.payment_proofs), 0, 'packer cannot read payment proofs');
select is((select count(*)::integer from public.wallet_transactions), 0, 'packer cannot read wallet entries');
select is((select count(*)::integer from public.profit_rules), 0, 'packer cannot read profit rules');
select is((select count(*)::integer from public.exchange_rates), 0, 'packer cannot read exchange-rate history');
select is((select count(*)::integer from public.cartons), 1, 'packer can access carton operations');
select is((select count(*)::integer from public.get_warehouse_packing_queue()), 2, 'packer receives eligible items through the limited packing queue');
select throws_ok(
  $$select * from public.get_warehouse_receiving_queue()$$,
  '42501',
  'receiving access required',
  'packer cannot call the receiving queue RPC'
);

-- Operational and owner roles retain their intended access.
select set_config('request.jwt.claim.sub', '75000000-0000-0000-0000-000000000006', true);
select is((select count(*)::integer from public.order_items), 2, 'admin can access operational orders');
select is((select count(*)::integer from public.payment_proofs), 2, 'admin can access payment operations');
select is((select count(*)::integer from public.get_warehouse_receiving_queue()), 2, 'admin can access the receiving queue');
select is((select count(*)::integer from public.get_warehouse_packing_queue()), 2, 'admin can access the packing queue');

select set_config('request.jwt.claim.sub', '76000000-0000-0000-0000-000000000007', true);
select is((select count(*)::integer from public.profit_rules), 1, 'super admin can access owner-level profit settings');
select is(
  (
    select count(*)::integer
    from public.profiles
    where id in (
      '71000000-0000-0000-0000-000000000001',
      '72000000-0000-0000-0000-000000000002',
      '73000000-0000-0000-0000-000000000003',
      '73000000-0000-0000-0000-000000000004',
      '74000000-0000-0000-0000-000000000005',
      '75000000-0000-0000-0000-000000000006',
      '76000000-0000-0000-0000-000000000007'
    )
  ),
  7,
  'super admin can access all seeded profiles'
);

select * from finish();
rollback;
