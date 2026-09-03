begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

select has_function('public', 'review_payment_proof', array['uuid','text','numeric','numeric','text'], 'payment review RPC exists');
select has_function('public', 'create_exchange_rate', array['numeric','date','text'], 'append rate RPC exists');
select has_trigger('public', 'payment_proofs', 'payment_proofs_terminal_immutable', 'terminal proof immutability trigger exists');

insert into auth.users (id, email, raw_user_meta_data) values
  ('14000000-0000-0000-0000-000000000001', 'phase3-owner@example.test', '{"full_name":"Phase 3 Owner"}'),
  ('14000000-0000-0000-0000-000000000002', 'phase3-admin@example.test', '{"full_name":"Phase 3 Admin"}'),
  ('14000000-0000-0000-0000-000000000003', 'phase3-client@example.test', '{"full_name":"Phase 3 Client"}'),
  ('14000000-0000-0000-0000-000000000004', 'phase3-staff@example.test', '{"full_name":"Phase 3 Staff"}');
update public.profiles set role = 'super_admin' where id = '14000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin' where id = '14000000-0000-0000-0000-000000000002';
update public.profiles set role = 'staff_receiver' where id = '14000000-0000-0000-0000-000000000004';
insert into public.clients (id, profile_id, business_name)
values ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000003', 'Phase 3 Client');

set local role authenticated;
select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000003', true);
insert into public.payment_proofs (id, client_id, amount_bdt, paid_at, proof_file_path) values
  ('34000000-0000-0000-0000-000000000001', '24000000-0000-0000-0000-000000000001', 1900, current_date, '14000000-0000-0000-0000-000000000003/a.jpg'),
  ('34000000-0000-0000-0000-000000000002', '24000000-0000-0000-0000-000000000001', 500, current_date, '14000000-0000-0000-0000-000000000003/b.pdf'),
  ('34000000-0000-0000-0000-000000000003', '24000000-0000-0000-0000-000000000001', 700, current_date, '14000000-0000-0000-0000-000000000003/c.png');

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000001','approve',1920,19.2,'verified')$$,
  '42501', 'admin role required', 'warehouse staff cannot review payments'
);

select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000001','approve',1920,19.2,null)$$,
  '22023', 'amount mismatch reason is required', 'mismatch approval requires a reason'
);
select lives_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000001','approve',1920,19.2,'Bank verified 1920')$$,
  'admin approves a verified payment atomically'
);
select is((select status::text from public.payment_proofs where id = '34000000-0000-0000-0000-000000000001'), 'approved', 'proof becomes approved');
select is((select amount_bdt from public.payment_proofs where id = '34000000-0000-0000-0000-000000000001'), 1900.00::numeric, 'client claim is preserved');
select is((select approved_amount_bdt from public.payment_proofs where id = '34000000-0000-0000-0000-000000000001'), 1920.00::numeric, 'verified amount is stored separately');
select is((select amount_cny from public.wallet_transactions where payment_proof_id = '34000000-0000-0000-0000-000000000001'), 100.00::numeric, 'wallet receives exact rounded CNY credit');
select is((select cny_to_bdt_rate from public.wallet_transactions where payment_proof_id = '34000000-0000-0000-0000-000000000001'), 19.2000::numeric, 'credit snapshots approval rate');
select is((select count(*)::integer from public.wallet_transactions where payment_proof_id = '34000000-0000-0000-0000-000000000001'), 1, 'one proof has exactly one credit');
select lives_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000001','approve',1920,19.2,'Bank verified 1920')$$,
  'matching approval retry is idempotent'
);
select is((select count(*)::integer from public.wallet_transactions where payment_proof_id = '34000000-0000-0000-0000-000000000001'), 1, 'approval retry creates no duplicate credit');
select is((select count(*)::integer from public.notifications where profile_id = '14000000-0000-0000-0000-000000000003' and entity_id = '34000000-0000-0000-0000-000000000001'), 1, 'approval retry creates no duplicate client notification');
select throws_ok(
  $$update public.payment_proofs set approved_amount_bdt = 2000 where id = '34000000-0000-0000-0000-000000000001'$$,
  '42501', null, 'direct reviewed-proof updates are denied'
);

select throws_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000002','reject',null,null,null)$$,
  '22023', 'rejection reason is required', 'rejection requires a reason'
);
select lives_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000002','needs_review',null,null,'Reference unclear')$$,
  'admin can mark a proof needs review'
);
select is((select reviewed_by from public.payment_proofs where id = '34000000-0000-0000-0000-000000000002'), '14000000-0000-0000-0000-000000000002'::uuid, 'reviewer comes from the session');
select lives_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000002','reject',null,null,'Could not verify transfer')$$,
  'needs-review proof can be rejected'
);
select lives_ok(
  $$select * from public.review_payment_proof('34000000-0000-0000-0000-000000000003','cancel',null,null,'Duplicate submission')$$,
  'admin can cancel an eligible proof with reason'
);
select is((select count(*)::integer from public.wallet_transactions where payment_proof_id in ('34000000-0000-0000-0000-000000000002','34000000-0000-0000-0000-000000000003')), 0, 'non-approval decisions never credit wallet');

select throws_ok(
  $$select public.create_exchange_rate(20.1, current_date, 'admin_default')$$,
  '42501', 'super admin role required', 'regular admin cannot create default rates'
);
select set_config('request.jwt.claim.sub', '14000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select public.create_exchange_rate(20.1, current_date, 'admin_default')$$,
  'super admin appends a same-day rate'
);
select is((select cny_to_bdt from public.get_current_exchange_rate()), 20.1000::numeric, 'latest effective same-day rate becomes current');
select throws_ok(
  $$update public.exchange_rates set cny_to_bdt = 22 where cny_to_bdt = 20.1$$,
  '42501', null, 'exchange rate table cannot be updated directly'
);
select lives_ok(
  $$insert into public.payment_instructions (method,label,account_identifier,created_by,updated_by)
    values ('mobile_wallet','Verified wallet','01XXXXXXXXX','14000000-0000-0000-0000-000000000001','14000000-0000-0000-0000-000000000001')$$,
  'super admin manages payment destinations'
);

select * from finish();
rollback;
