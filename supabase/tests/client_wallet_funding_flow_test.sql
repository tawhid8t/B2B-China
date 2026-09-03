begin;

create extension if not exists pgtap with schema extensions;
select plan(19);

select has_function('public', 'get_current_exchange_rate', array[]::text[], 'current-rate RPC exists');
select has_function('public', 'cancel_own_payment_proof', array['uuid'], 'client cancellation RPC exists');
select has_trigger('public', 'payment_proofs', 'payment_proofs_notify_admins', 'payment submission notification trigger exists');

insert into auth.users (id, email, raw_user_meta_data) values
  ('13000000-0000-0000-0000-000000000001', 'funding-admin@example.test', '{"full_name":"Funding Admin"}'),
  ('13000000-0000-0000-0000-000000000002', 'funding-client@example.test', '{"full_name":"Funding Client"}'),
  ('13000000-0000-0000-0000-000000000003', 'funding-other@example.test', '{"full_name":"Other Client"}'),
  ('13000000-0000-0000-0000-000000000004', 'funding-staff@example.test', '{"full_name":"Funding Staff"}');

update public.profiles set role = 'admin' where id = '13000000-0000-0000-0000-000000000001';
update public.profiles set role = 'staff_receiver' where id = '13000000-0000-0000-0000-000000000004';

insert into public.clients (id, profile_id, business_name) values
  ('23000000-0000-0000-0000-000000000001', '13000000-0000-0000-0000-000000000002', 'Funding Client'),
  ('23000000-0000-0000-0000-000000000002', '13000000-0000-0000-0000-000000000003', 'Other Client');

set local role authenticated;
select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);

select is(
  (select cny_to_bdt from public.get_current_exchange_rate()),
  19.2000::numeric,
  'client reads the persisted current exchange rate'
);

select throws_ok(
  $$insert into public.payment_proofs (client_id, amount_bdt, paid_at)
    values ('23000000-0000-0000-0000-000000000001', 1920, current_date)$$,
  '23514',
  null,
  'new payment proof requires a private file path'
);

select lives_ok(
  $$insert into public.payment_proofs (id, client_id, amount_bdt, paid_at, proof_file_path)
    values (
      '33000000-0000-0000-0000-000000000001',
      '23000000-0000-0000-0000-000000000001',
      1920,
      current_date,
      '13000000-0000-0000-0000-000000000002/proof.jpg'
    )$$,
  'client submits a pending proof with private evidence'
);

select is(
  (select status::text from public.payment_proofs where id = '33000000-0000-0000-0000-000000000001'),
  'pending',
  'submitted proof remains pending'
);

select is(
  (select count(*)::integer from public.wallet_transactions where payment_proof_id = '33000000-0000-0000-0000-000000000001'),
  0,
  'submission does not create wallet credit'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.notifications
    where profile_id = '13000000-0000-0000-0000-000000000001'
      and entity_type = 'payment_proof'
      and entity_id = '33000000-0000-0000-0000-000000000001'),
  1,
  'active admin receives one durable notification'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000003', true);
select throws_ok(
  $$select public.cancel_own_payment_proof('33000000-0000-0000-0000-000000000001')$$,
  'P0002',
  'payment proof not found',
  'another client cannot cancel the proof'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000004', true);
select throws_ok(
  $$select * from public.get_current_exchange_rate()$$,
  '42501',
  'exchange-rate access denied',
  'warehouse staff cannot read financial rate settings'
);

select throws_ok(
  $$select public.cancel_own_payment_proof('33000000-0000-0000-0000-000000000001')$$,
  '42501',
  'client role required',
  'warehouse staff cannot cancel client payment proofs'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
select lives_ok(
  $$select public.cancel_own_payment_proof('33000000-0000-0000-0000-000000000001')$$,
  'submitting client can cancel a pending proof'
);

select is(
  (select status::text from public.payment_proofs where id = '33000000-0000-0000-0000-000000000001'),
  'cancelled',
  'cancelled proof persists its terminal state'
);

select lives_ok(
  $$select public.cancel_own_payment_proof('33000000-0000-0000-0000-000000000001')$$,
  'client cancellation retry is idempotent'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
insert into public.payment_proofs (
  id, client_id, amount_bdt, paid_at, proof_file_path
)
values (
  '33000000-0000-0000-0000-000000000002',
  '23000000-0000-0000-0000-000000000001',
  3840,
  current_date,
  '13000000-0000-0000-0000-000000000002/review.pdf'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
select lives_ok(
  $$select * from public.review_payment_proof(
    '33000000-0000-0000-0000-000000000002',
    'needs_review', null, null, 'Reference is unclear'
  )$$,
  'admin starts review through the protected payment command'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$select public.cancel_own_payment_proof('33000000-0000-0000-0000-000000000002')$$,
  '23514',
  'only a pending payment proof can be cancelled by its client',
  'client cannot cancel a proof after review begins'
);

select is(
  (select count(*)::integer from public.payment_proofs where client_id = '23000000-0000-0000-0000-000000000001'),
  2,
  'client history retains cancelled and needs-review submissions'
);

select set_config('request.jwt.claim.sub', '13000000-0000-0000-0000-000000000001', true);
select is(
  (select count(*)::integer from public.notifications
    where profile_id = '13000000-0000-0000-0000-000000000001'
      and entity_type = 'payment_proof'
      and entity_id in (
        '33000000-0000-0000-0000-000000000001',
        '33000000-0000-0000-0000-000000000002'
      )),
  2,
  'each proof submission creates one notification per active admin'
);

select * from finish();
rollback;
