-- A provider order may contain several BridgeCart order lines.  Existing rows
-- remain intact; the line identity is the existing order_item_id relationship.
begin;

drop index if exists public.provider_orders_provider_reference_key;

create unique index provider_orders_provider_order_item_reference_key
on public.provider_orders (provider, provider_order_id, order_item_id)
where provider_order_id is not null;

create or replace function private.sync_provider_order_and_commit_wallet_internal(
  p_order_item_id uuid, p_provider text, p_provider_order_id text, p_paid_amount_cny numeric,
  p_seller_tracking_number text, p_provider_status text, p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null
)
returns table (
  provider_order_record_id uuid, order_item_status public.order_status, synced_at timestamptz,
  reservation_transaction_id uuid, release_transaction_id uuid, debit_transaction_id uuid,
  debited_amount_cny numeric(14,2), uncovered_amount_cny numeric(14,2), applied_rate numeric(10,4)
)
language plpgsql security definer set search_path = ''
as $$
declare
  v_actor uuid := auth.uid(); v_role public.user_role; v_order public.order_items%rowtype;
  v_provider_order public.provider_orders%rowtype; v_commit record; v_synced_at timestamptz := now();
  v_normalized_status public.provider_order_status;
begin
  select p.role into v_role from public.profiles p where p.id = v_actor;
  if v_actor is null or v_role not in ('admin', 'super_admin') then raise exception using errcode = '42501', message = 'admin role required'; end if;
  if nullif(btrim(p_provider), '') is null or nullif(btrim(p_provider_order_id), '') is null then raise exception using errcode = '22023', message = 'provider and provider order ID are required'; end if;
  if p_paid_amount_cny is null or p_paid_amount_cny <= 0 then raise exception using errcode = '22023', message = 'positive paid amount is required'; end if;

  select * into v_order from public.order_items oi where oi.id = p_order_item_id;
  if not found then raise exception using errcode = 'P0002', message = 'order item not found'; end if;
  if v_order.status not in ('queued_for_purchase', 'purchased', 'seller_shipped') then raise exception using errcode = '23514', message = 'order is not eligible for provider purchase sync'; end if;

  v_normalized_status := case
    when p_provider_status in ('cancelled', 'refund_requested', 'refunded', 'exception') then p_provider_status::public.provider_order_status
    when p_provider_status in ('seller_shipped', 'shipped') or nullif(btrim(p_seller_tracking_number), '') is not null then 'seller_shipped'::public.provider_order_status
    else 'paid'::public.provider_order_status
  end;

  insert into public.provider_orders (order_item_id, provider, provider_order_id, paid_amount_cny, seller_tracking_number, provider_status, status, raw_payload, synced_at)
  values (p_order_item_id, btrim(p_provider), btrim(p_provider_order_id), p_paid_amount_cny, nullif(btrim(p_seller_tracking_number), ''), p_provider_status, v_normalized_status, coalesce(p_raw_payload, '{}'::jsonb), v_synced_at)
  on conflict (provider, provider_order_id, order_item_id) where provider_order_id is not null
  do update set
    seller_tracking_number = coalesce(excluded.seller_tracking_number, public.provider_orders.seller_tracking_number),
    provider_status = excluded.provider_status, status = excluded.status, raw_payload = excluded.raw_payload, synced_at = excluded.synced_at
  where public.provider_orders.paid_amount_cny = excluded.paid_amount_cny
  returning * into v_provider_order;

  if not found then raise exception using errcode = '23505', message = 'provider order line conflicts with an existing paid purchase'; end if;

  select * into v_commit from private.convert_wallet_reservation_to_order_debit_internal(p_order_item_id, p_paid_amount_cny, p_cny_to_bdt_rate, 'provider order synced and purchase committed');
  update public.order_items set actual_total_bdt = round(p_paid_amount_cny * v_commit.applied_rate, 2) where id = p_order_item_id;
  select * into v_order from public.order_items oi where oi.id = p_order_item_id;
  if v_order.status = 'queued_for_purchase' then v_order := private.change_order_status_internal(p_order_item_id, 'purchased', 'provider order and paid amount recorded'); end if;
  if v_order.status = 'purchased' and v_normalized_status = 'seller_shipped' then v_order := private.change_order_status_internal(p_order_item_id, 'seller_shipped', 'seller tracking recorded by provider sync'); end if;

  insert into public.integration_logs (provider, operation, request_payload, response_payload, status)
  values (btrim(p_provider), 'provider_order_sync', jsonb_build_object('orderItemId', p_order_item_id, 'providerOrderId', p_provider_order_id, 'paidAmountCny', p_paid_amount_cny, 'providerStatus', p_provider_status), jsonb_build_object('providerOrderRecordId', v_provider_order.id, 'orderStatus', v_order.status, 'debitTransactionId', v_commit.debit_transaction_id, 'uncoveredAmountCny', v_commit.uncovered_amount_cny), 'success');

  return query select v_provider_order.id, v_order.status, v_synced_at, v_commit.reservation_transaction_id, v_commit.release_transaction_id, v_commit.debit_transaction_id, v_commit.debited_amount_cny, v_commit.uncovered_amount_cny, v_commit.applied_rate;
end;
$$;

revoke all on function private.sync_provider_order_and_commit_wallet_internal(uuid, text, text, numeric, text, text, jsonb, numeric) from public, anon;
grant execute on function private.sync_provider_order_and_commit_wallet_internal(uuid, text, text, numeric, text, text, jsonb, numeric) to authenticated, service_role;

commit;
