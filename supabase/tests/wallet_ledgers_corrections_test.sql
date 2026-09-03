begin;

create extension if not exists pgtap with schema extensions;
select plan(25);

select has_function('public', 'get_wallet_statement', array['uuid','integer','integer','text','date','date'], 'canonical wallet statement RPC exists');
select has_function('public', 'create_wallet_adjustment', array['uuid','numeric','numeric','text'], 'manual adjustment RPC exists');
select has_function('public', 'correct_wallet_transaction', array['uuid','numeric','text'], 'linked correction RPC exists');

insert into auth.users (id, email, raw_user_meta_data) values
  ('15000000-0000-0000-0000-000000000001', 'ledger-admin@example.test', '{"full_name":"Ledger Admin"}'),
  ('15000000-0000-0000-0000-000000000002', 'ledger-client@example.test', '{"full_name":"Ledger Client"}'),
  ('15000000-0000-0000-0000-000000000003', 'ledger-other@example.test', '{"full_name":"Other Client"}'),
  ('15000000-0000-0000-0000-000000000004', 'ledger-staff@example.test', '{"full_name":"Ledger Staff"}');
update public.profiles set role = 'admin' where id = '15000000-0000-0000-0000-000000000001';
update public.profiles set role = 'staff_receiver' where id = '15000000-0000-0000-0000-000000000004';
insert into public.clients (id, profile_id, business_name) values
  ('25000000-0000-0000-0000-000000000001', '15000000-0000-0000-0000-000000000002', 'Ledger Client'),
  ('25000000-0000-0000-0000-000000000002', '15000000-0000-0000-0000-000000000003', 'Other Client');

set local role authenticated;
select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select * from public.get_wallet_statement('25000000-0000-0000-0000-000000000001',1,30,null,null,null)$$,
  '42501', 'wallet statement access denied', 'warehouse staff cannot read wallet statements'
);

select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000002', true);
select is((select count(*)::integer from public.get_wallet_statement(null,1,30,null,null,null)), 0, 'client empty statement is empty');
select throws_ok(
  $$select * from public.get_wallet_statement('25000000-0000-0000-0000-000000000002',1,30,null,null,null)$$,
  '42501', 'wallet statement access denied', 'client cannot request another wallet'
);
select throws_ok(
  $$select public.create_wallet_adjustment('25000000-0000-0000-0000-000000000001',100,19.2,'not allowed')$$,
  '42501', 'admin role required', 'client cannot create adjustments'
);

select set_config('request.jwt.claim.sub', '15000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_wallet_adjustment('25000000-0000-0000-0000-000000000001',100,19.2,'initial credit')$$,
  'admin posts a positive adjustment'
);
select is((select available_balance_cny from public.get_client_wallet_totals('25000000-0000-0000-0000-000000000001')), 100.00::numeric, 'positive adjustment increases available funds');
select is((select count(*)::integer from public.get_wallet_statement('25000000-0000-0000-0000-000000000001',1,30,null,null,null)), 1, 'admin statement returns the ledger entry');
select is((select actor_id from public.get_wallet_statement('25000000-0000-0000-0000-000000000001',1,30,null,null,null)), '15000000-0000-0000-0000-000000000001'::uuid, 'statement records session-derived actor');

select lives_ok(
  $$select public.correct_wallet_transaction((select id from public.wallet_transactions where notes = 'initial credit'),30,'partial credit correction')$$,
  'admin posts a partial linked correction'
);
select is((select transaction_type::text from public.wallet_transactions where notes = 'partial credit correction'), 'adjustment', 'correction of a credit is a negative adjustment');
select is((select count(*)::integer from public.wallet_transactions where corrects_transaction_id = (select id from public.wallet_transactions where notes = 'initial credit')), 1, 'correction links to its source');
select is((select correction_remaining_cny from public.get_wallet_statement('25000000-0000-0000-0000-000000000001',1,30,null,null,null) where reason = 'initial credit'), 70.00::numeric, 'statement reports uncorrected remainder');
select throws_ok(
  $$select public.correct_wallet_transaction((select id from public.wallet_transactions where notes = 'initial credit'),71,'too much')$$,
  '23514', 'wallet correction exceeds the uncorrected original amount', 'correction cannot exceed remaining source amount'
);
select lives_ok(
  $$select public.correct_wallet_transaction((select id from public.wallet_transactions where notes = 'initial credit'),70,'full remaining correction')$$,
  'admin posts the full remaining correction'
);
select is((select available_balance_cny from public.get_client_wallet_totals('25000000-0000-0000-0000-000000000001')), 0.00::numeric, 'full correction can reduce available funds to zero');

select lives_ok(
  $$select public.create_wallet_adjustment('25000000-0000-0000-0000-000000000001',100,19.2,'second credit')$$,
  'admin posts a second credit'
);
select throws_ok(
  $$select public.create_wallet_adjustment('25000000-0000-0000-0000-000000000001',-101,19.2,'unsafe deduction')$$,
  '23514', 'adjustment would make available wallet balance negative', 'negative adjustment cannot overdraw available funds'
);
select lives_ok(
  $$select public.create_wallet_adjustment('25000000-0000-0000-0000-000000000001',-25,19.2,'deduction')$$,
  'safe negative adjustment is posted'
);
select is((select available_balance_cny from public.get_client_wallet_totals('25000000-0000-0000-0000-000000000001')), 75.00::numeric, 'negative adjustment reduces available funds');
select lives_ok(
  $$select public.correct_wallet_transaction((select id from public.wallet_transactions where notes = 'deduction'),10,'partial deduction refund')$$,
  'negative entry can receive a partial linked refund'
);
select is((select transaction_type::text from public.wallet_transactions where notes = 'partial deduction refund'), 'refund', 'correction of a debit is a refund');
select is((select available_balance_cny from public.get_client_wallet_totals('25000000-0000-0000-0000-000000000001')), 85.00::numeric, 'refund increases available funds without over-correction');

select * from finish();
rollback;
