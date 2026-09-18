-- LOCAL/DEDICATED-STAGING ONLY. This is fictional data; never run it against
-- a linked, preview, or production database. It contains inserts only so a
-- local `supabase db reset --local` remains reproducible after migrations.
begin;

-- Auth rows let local Auth issue sessions for the role fixtures. The automatic
-- profile trigger may insert client profiles; the following upserts set their
-- deliberate test roles without relying on user-controlled metadata.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'staging.client@example.test', crypt('staging-client-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'staging.receiver@example.test', crypt('staging-receiver-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'staging.packer@example.test', crypt('staging-packer-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'staging.admin@example.test', crypt('staging-admin-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now()),
  ('00000000-0000-0000-0000-000000000000', '10000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'staging.superadmin@example.test', crypt('staging-superadmin-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.profiles (id, role, full_name, email, status)
values
  ('10000000-0000-0000-0000-000000000001', 'client', 'Staging Client', 'staging.client@example.test', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'staff_receiver', 'Staging Receiver', 'staging.receiver@example.test', 'active'),
  ('10000000-0000-0000-0000-000000000003', 'staff_packer', 'Staging Packer', 'staging.packer@example.test', 'active'),
  ('10000000-0000-0000-0000-000000000004', 'admin', 'Staging Admin', 'staging.admin@example.test', 'active'),
  ('10000000-0000-0000-0000-000000000005', 'super_admin', 'Staging Super Admin', 'staging.superadmin@example.test', 'active')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name, email = excluded.email, status = excluded.status;

insert into public.clients (id, profile_id, business_name, assigned_admin_id)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Staging Import House', '10000000-0000-0000-0000-000000000004')
on conflict (id) do nothing;

insert into public.product_links (id, original_url, provider, provider_item_id, title, images, category, domestic_delivery_cny, created_by)
values
  ('30000000-0000-0000-0000-000000000001', 'https://detail.1688.com/offer/900000000001.html', '1688', '900000000001', 'Staging multi-SKU canvas shoes', array['https://example.test/staging-shoes.png'], 'default', 8.00, '10000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000002', 'https://detail.1688.com/offer/900000000002.html', '1688', '900000000002', 'Staging fulfillment backpack', array['https://example.test/staging-bag.png'], 'default', 6.00, '10000000-0000-0000-0000-000000000004'),
  ('30000000-0000-0000-0000-000000000003', 'https://detail.1688.com/offer/900000000003.html', '1688', '900000000003', 'Staging exception jacket', array['https://example.test/staging-jacket.png'], 'default', 10.00, '10000000-0000-0000-0000-000000000004')
on conflict (id) do nothing;

insert into public.product_skus (id, product_link_id, provider_sku_id, label, attributes, price_cny, image_url)
values
  ('31000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'shoe-red-40', 'Red / EU 40', '{"color":"Red","size":"EU 40"}', 32.00, 'https://example.test/staging-red-40.png'),
  ('31000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', 'shoe-blue-41', 'Blue / EU 41', '{"color":"Blue","size":"EU 41"}', 34.00, 'https://example.test/staging-blue-41.png'),
  ('31000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', 'bag-black', 'Black / Standard', '{"color":"Black","size":"Standard"}', 50.00, 'https://example.test/staging-bag-black.png'),
  ('31000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000003', 'jacket-green-l', 'Green / L', '{"color":"Green","size":"L"}', 76.00, 'https://example.test/staging-jacket-green.png')
on conflict (id) do nothing;

insert into public.product_orders (id, order_number, client_id, product_link_id, submission_key)
values
  ('40000000-0000-0000-0000-000000000001', 'PORD-STAGING-PENDING', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'staging:pending'),
  ('40000000-0000-0000-0000-000000000002', 'PORD-STAGING-QUEUE', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'staging:queue'),
  ('40000000-0000-0000-0000-000000000003', 'PORD-STAGING-CART', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', 'staging:cart'),
  ('40000000-0000-0000-0000-000000000004', 'PORD-STAGING-FULFILLMENT', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', 'staging:fulfillment'),
  ('40000000-0000-0000-0000-000000000005', 'PORD-STAGING-EXCEPTION', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', 'staging:exception')
on conflict (id) do nothing;

insert into public.order_items (id, client_id, product_link_id, product_order_id, product_sku_id, sku_id, quantity, cny_price, domestic_delivery_cny, estimated_total_bdt, status)
values
  ('41000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000001', 'shoe-red-40', 2, 32.00, 4.00, 936.00, 'pending_admin_review'),
  ('41000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '31000000-0000-0000-0000-000000000002', 'shoe-blue-41', 1, 34.00, 4.00, 456.00, 'pending_admin_review'),
  ('41000000-0000-0000-0000-000000000003', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000001', 'shoe-red-40', 1, 32.00, 4.00, 432.00, 'queued_for_purchase'),
  ('41000000-0000-0000-0000-000000000004', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', '31000000-0000-0000-0000-000000000002', 'shoe-blue-41', 3, 34.00, 4.00, 1380.00, 'queued_for_purchase'),
  ('41000000-0000-0000-0000-000000000005', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000001', 'shoe-red-40', 1, 32.00, 8.00, 480.00, 'queued_for_purchase'),
  ('41000000-0000-0000-0000-000000000006', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000003', '31000000-0000-0000-0000-000000000002', 'shoe-blue-41', 1, 34.00, 0.00, 408.00, 'queued_for_purchase'),
  ('41000000-0000-0000-0000-000000000007', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000004', '31000000-0000-0000-0000-000000000003', 'bag-black', 2, 50.00, 6.00, 1272.00, 'qc_checked'),
  ('41000000-0000-0000-0000-000000000008', '20000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000005', '31000000-0000-0000-0000-000000000004', 'jacket-green-l', 1, 76.00, 10.00, 1032.00, 'exception')
on conflict (id) do nothing;

insert into public.purchase_batches (id, batch_code, status, created_by)
values
  ('50000000-0000-0000-0000-000000000001', 'PB-STAGING-QUEUE', 'sent_to_extension', '10000000-0000-0000-0000-000000000004'),
  ('50000000-0000-0000-0000-000000000002', 'PB-STAGING-CART', 'sent_to_extension', '10000000-0000-0000-0000-000000000004')
on conflict (id) do nothing;

insert into public.purchase_batch_items (purchase_batch_id, order_item_id, status)
values
  ('50000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000003', 'queued'),
  ('50000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000004', 'queued'),
  ('50000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000005', 'queued'),
  ('50000000-0000-0000-0000-000000000002', '41000000-0000-0000-0000-000000000006', 'queued')
on conflict (purchase_batch_id, order_item_id) do nothing;

update public.purchase_tasks set state = 'cart_added', cart_added_at = now(), cart_added_by = '10000000-0000-0000-0000-000000000004'
where product_order_id = '40000000-0000-0000-0000-000000000003';

-- Phase 3A: fictional post-negotiation provider capture. This is deliberately
-- only evidence awaiting an admin decision; no product is purchased here.
with capture as (
  insert into public.provider_purchase_captures (
    id, purchase_task_id, provider_order_id, seller_name, purchased_at,
    domestic_delivery_cny, discount_cny, final_paid_cny, raw_capture, captured_by
  )
  select
    '61000000-0000-0000-0000-000000000001', task.id, 'STAGING-1688-DRAFT-003',
    'Fictional 1688 Seller', now(), 6.00, 2.00, 67.00,
    '{"source":"fictional-staging","checkout":"not-performed"}'::jsonb,
    '10000000-0000-0000-0000-000000000004'
  from public.purchase_tasks task
  where task.product_order_id = '40000000-0000-0000-0000-000000000003'
    and not exists (select 1 from public.provider_purchase_captures where id = '61000000-0000-0000-0000-000000000001')
  returning id
)
insert into public.provider_purchase_capture_lines (
  capture_id, order_item_id, provider_sku_id, quantity, actual_unit_price_cny, actual_subtotal_cny
)
select capture.id, line.order_item_id, line.provider_sku_id, line.quantity, line.actual_unit_price_cny, line.actual_subtotal_cny
from capture
cross join (values
  ('41000000-0000-0000-0000-000000000005'::uuid, 'shoe-red-40', 1, 31.00::numeric, 31.00::numeric),
  ('41000000-0000-0000-0000-000000000006'::uuid, 'shoe-blue-41', 1, 32.00::numeric, 32.00::numeric)
) as line(order_item_id, provider_sku_id, quantity, actual_unit_price_cny, actual_subtotal_cny);

update public.purchase_tasks set state = 'awaiting_admin_confirmation', last_error = null
where product_order_id = '40000000-0000-0000-0000-000000000003'
  and exists (select 1 from public.provider_purchase_captures where id = '61000000-0000-0000-0000-000000000001');

insert into public.provider_orders (id, order_item_id, provider, provider_order_id, paid_amount_cny, seller_tracking_number, provider_status, status, synced_at)
values ('60000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000007', '1688', 'STAGING-1688-ORDER-001', 106.00, 'STAGING-CN-TRACK-001', 'seller_shipped', 'seller_shipped', now())
on conflict (id) do nothing;

insert into public.parcels (id, provider_order_id, tracking_number, expected_pieces, received_pieces, weight_kg, assigned_staff_id, status, received_at)
values ('70000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 'STAGING-CN-TRACK-001', 2, 2, 1.200, '10000000-0000-0000-0000-000000000002', 'received', now())
on conflict (id) do nothing;

insert into public.parcel_items (parcel_id, order_item_id, expected_pieces, received_pieces, weight_kg, qc_status, qc_notes, checked_by, checked_at)
values ('70000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000007', 2, 2, 1.200, 'pass', 'Fictional staging QC pass.', '10000000-0000-0000-0000-000000000002', now())
on conflict (parcel_id, order_item_id) do nothing;

insert into public.cartons (id, client_id, carton_code, category, net_weight_kg, gross_weight_kg, order_item_ids, shipping_mark, guangzhou_tracking_number, status, created_by)
values ('80000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CTN-STAGING-001', 'default', 1.200, 1.500, array['41000000-0000-0000-0000-000000000007'::uuid], 'STAGING IMPORT HOUSE', 'STAGING-GZ-TRACK-001', 'packed', '10000000-0000-0000-0000-000000000003')
on conflict (id) do nothing;

insert into public.carton_items (carton_id, order_item_id, quantity)
values ('80000000-0000-0000-0000-000000000001', '41000000-0000-0000-0000-000000000007', 2)
on conflict (carton_id, order_item_id) do nothing;

insert into public.tracking_events (entity_type, entity_id, tracking_number, courier_name, status, location, description, event_time)
values ('carton', '80000000-0000-0000-0000-000000000001', 'STAGING-GZ-TRACK-001', 'Staging Courier', 'manual_recorded', 'Guangzhou', 'Fictional staging hand-off record.', now());

insert into public.payment_proofs (id, client_id, amount_bdt, paid_at, proof_file_path, status, notes)
values ('90000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 5000.00, current_date, 'staging/payment-proof-placeholder.png', 'pending', 'Fictional staging payment proof awaiting review.')
on conflict (id) do nothing;

insert into public.wallet_transactions (id, client_id, transaction_type, amount_bdt, amount_cny, cny_to_bdt_rate, running_balance_cny, status, notes, created_by)
values ('91000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'advance_credit', 6000.00, 500.00, 12.0000, 500.00, 'posted', 'Fictional staging wallet credit.', '10000000-0000-0000-0000-000000000004')
on conflict (id) do nothing;

insert into public.extension_credentials (id, profile_id, token_hash, label)
values ('92000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', '0000000000000000000000000000000000000000000000000000000000000000', 'STAGING PLACEHOLDER — not usable')
on conflict (id) do nothing;

insert into public.notifications (profile_id, title, body, entity_type, entity_id)
values
  ('10000000-0000-0000-0000-000000000004', 'Staging exception requires review', 'PORD-STAGING-EXCEPTION is fictional test data.', 'product_order', '40000000-0000-0000-0000-000000000005'),
  ('10000000-0000-0000-0000-000000000001', 'Staging proof received', 'Your fictional staging payment proof is pending review.', 'payment_proof', '90000000-0000-0000-0000-000000000001');

commit;
