begin;

create extension if not exists pgtap with schema extensions;
select plan(27);

select has_column('public', 'payment_proofs', 'approved_amount_bdt', 'verified payment amount is stored separately');
select has_column('public', 'payment_proofs', 'review_reason', 'payment review reason is persisted');
select has_column('public', 'wallet_transactions', 'corrects_transaction_id', 'wallet corrections link to their source');
select has_table('public', 'payment_instructions', 'payment instructions table exists');
select has_function('public', 'get_client_wallet_totals', array['uuid'], 'canonical wallet totals function exists');

select col_type_is('public', 'payment_proofs', 'approved_amount_bdt', 'numeric(14,2)', 'verified amount uses fixed precision');
select col_type_is('public', 'wallet_transactions', 'corrects_transaction_id', 'uuid', 'correction link uses UUID');
select col_type_is('public', 'payment_instructions', 'sort_order', 'integer', 'instruction ordering is numeric');

select is(
  (select cny_to_bdt from public.exchange_rates where source = 'system_default' and effective_on = date '2026-08-30'),
  19.2000::numeric,
  'the effective default is 19.2000 BDT per CNY'
);

select throws_ok(
  $$update public.exchange_rates set cny_to_bdt = 20 where source = 'system_default' and effective_on = date '2026-08-30'$$,
  '55000',
  'exchange-rate history is append-only; create a newly effective rate',
  'historical exchange rates cannot be edited'
);

select throws_ok(
  $$delete from public.exchange_rates where source = 'system_default' and effective_on = date '2026-08-30'$$,
  '55000',
  'exchange-rate history is append-only; create a newly effective rate',
  'historical exchange rates cannot be deleted'
);

insert into auth.users (id, email, raw_user_meta_data) values
  ('12000000-0000-0000-0000-000000000001', 'foundation-owner@example.test', '{"full_name":"Foundation Owner"}'),
  ('12000000-0000-0000-0000-000000000002', 'foundation-admin@example.test', '{"full_name":"Foundation Admin"}'),
  ('12000000-0000-0000-0000-000000000003', 'foundation-client@example.test', '{"full_name":"Foundation Client"}'),
  ('12000000-0000-0000-0000-000000000004', 'foundation-staff@example.test', '{"full_name":"Foundation Staff"}');

update public.profiles set role = 'super_admin' where id = '12000000-0000-0000-0000-000000000001';
update public.profiles set role = 'admin' where id = '12000000-0000-0000-0000-000000000002';
update public.profiles set role = 'staff_receiver' where id = '12000000-0000-0000-0000-000000000004';

insert into public.clients (id, profile_id, business_name)
values ('22000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000003', 'Foundation Client');

set local role authenticated;
select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000001', true);

insert into public.payment_instructions (
  id, method, label, account_identifier, created_by, updated_by
)
values (
  '32000000-0000-0000-0000-000000000001', 'mobile_wallet', 'Primary wallet', '01XXXXXXXXX',
  '12000000-0000-0000-0000-000000000001', '12000000-0000-0000-0000-000000000001'
);

select is(
  (select count(*)::integer from public.payment_instructions),
  1,
  'super admin can create a payment instruction'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select is(
  (select count(*)::integer from public.payment_instructions),
  1,
  'client can read active payment instructions'
);

select throws_ok(
  $$insert into public.payment_instructions (method, label, instructions, created_by, updated_by)
    values ('bank', 'Not allowed', 'test', '12000000-0000-0000-0000-000000000003', '12000000-0000-0000-0000-000000000003')$$,
  '42501',
  null,
  'client cannot create payment instructions'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*)::integer from public.payment_instructions),
  0,
  'warehouse staff cannot read payment instructions'
);

select throws_ok(
  $$select * from public.get_client_wallet_totals('22000000-0000-0000-0000-000000000001')$$,
  '42501',
  'wallet access denied',
  'warehouse staff cannot read wallet totals'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select results_eq(
  $$select total_funds_cny, active_reserved_cny, available_balance_cny
    from public.get_client_wallet_totals('22000000-0000-0000-0000-000000000001')$$,
  $$values (0.00::numeric, 0.00::numeric, 0.00::numeric)$$,
  'an empty wallet returns zero canonical totals'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);
select throws_ok(
  $$insert into public.payment_proofs (client_id, amount_bdt, paid_at, status)
    values ('22000000-0000-0000-0000-000000000001', 100, current_date, 'needs_review')$$,
  '23514',
  null,
  'needs-review proof requires a reason'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000003', true);
select lives_ok(
  $$insert into public.payment_proofs (client_id, amount_bdt, paid_at)
    values ('22000000-0000-0000-0000-000000000001', 100, current_date)$$,
  'client can create a pending proof without wallet credit'
);

select is(
  (select count(*)::integer from public.wallet_transactions where client_id = '22000000-0000-0000-0000-000000000001'),
  0,
  'pending proof does not create wallet credit'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000002', true);
select is(
  (select count(*)::integer from public.payment_proofs where client_id = '22000000-0000-0000-0000-000000000001'),
  1,
  'admin can read client payment proofs'
);

select set_config('request.jwt.claim.sub', '12000000-0000-0000-0000-000000000004', true);
select is(
  (select count(*)::integer from public.payment_proofs),
  0,
  'warehouse staff cannot read payment proofs'
);
select is(
  (select count(*)::integer from public.wallet_transactions),
  0,
  'warehouse staff cannot read wallet transactions'
);

select set_eq(
  $$select policyname from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname like 'payment_proof_objects_%'$$,
  $$values
    ('payment_proof_objects_admin_select'::name),
    ('payment_proof_objects_client_insert'::name),
    ('payment_proof_objects_client_select'::name)$$,
  'payment proof storage exposes only insert and protected read policies'
);

select is(
  (select public from storage.buckets where id = 'payment-proofs'),
  false,
  'payment proof bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'payment-proofs'),
  10485760::bigint,
  'payment proof bucket enforces the 10 MB limit'
);
select set_eq(
  $$select unnest(allowed_mime_types) from storage.buckets where id = 'payment-proofs'$$,
  $$values ('image/jpeg'::text), ('image/png'::text), ('image/webp'::text), ('application/pdf'::text)$$,
  'payment proof bucket accepts only configured image and PDF types'
);

select * from finish();
rollback;
