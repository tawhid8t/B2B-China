-- Forward-only lifecycle correction. Existing provider purchase facts are retained.
begin;

create or replace function public.sync_provider_order_and_commit_wallet_v2(
  p_order_item_id uuid, p_provider text, p_provider_order_id text, p_paid_amount_cny numeric,
  p_seller_tracking_number text, p_provider_status text, p_raw_payload jsonb default '{}'::jsonb,
  p_cny_to_bdt_rate numeric default null, p_purchase_batch_id uuid default null,
  p_provider_sku_id text default null, p_quantity_purchased integer default null,
  p_actual_unit_price_cny numeric default null, p_actual_product_subtotal_cny numeric default null,
  p_actual_domestic_delivery_cny numeric default null, p_actual_discount_cny numeric default null,
  p_purchased_at timestamptz default null
)
returns table (provider_order_record_id uuid, order_item_status public.order_status, synced_at timestamptz,
  reservation_transaction_id uuid, release_transaction_id uuid, debit_transaction_id uuid,
  debited_amount_cny numeric(14,2), uncovered_amount_cny numeric(14,2), applied_rate numeric(10,4))
language plpgsql security invoker set search_path = ''
as $$
declare
  v_result record;
  v_provider_order public.provider_orders%rowtype;
  v_batch_id uuid;
  v_order public.order_items%rowtype;
  v_tracking_number text := nullif(btrim(p_seller_tracking_number), '');
begin
  if public.current_user_role() not in ('admin', 'super_admin') then
    raise exception using errcode = '42501', message = 'admin role required';
  end if;

  select * into v_order from public.order_items where id = p_order_item_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'order item not found'; end if;
  if v_order.status not in ('queued_for_purchase', 'purchased', 'seller_shipped') then
    raise exception using errcode = '23514', message = 'order is not eligible for provider purchase sync';
  end if;

  if p_purchase_batch_id is not null then
    if not exists (select 1 from public.purchase_batch_items where purchase_batch_id = p_purchase_batch_id and order_item_id = p_order_item_id) then
      raise exception using errcode = '23514', message = 'purchase batch does not contain this order item';
    end if;
    v_batch_id := p_purchase_batch_id;
  else
    select purchase_batch_id into v_batch_id from public.purchase_batch_items where order_item_id = p_order_item_id order by created_at desc limit 1;
  end if;

  -- The existing purchase function owns the first, audited transition only.
  -- Passing no tracking prevents an internal queued_for_purchase -> seller_shipped shortcut.
  select * into v_result from private.sync_provider_order_and_commit_wallet_internal(
    p_order_item_id, p_provider, p_provider_order_id, p_paid_amount_cny,
    null, p_provider_status, p_raw_payload, p_cny_to_bdt_rate
  );

  update public.provider_orders
  set purchase_batch_id = coalesce(v_batch_id, purchase_batch_id),
      seller_tracking_number = coalesce(v_tracking_number, seller_tracking_number),
      provider_sku_id = coalesce(nullif(btrim(p_provider_sku_id), ''), provider_sku_id),
      quantity_purchased = coalesce(p_quantity_purchased, quantity_purchased),
      actual_unit_price_cny = coalesce(p_actual_unit_price_cny, actual_unit_price_cny),
      actual_product_subtotal_cny = coalesce(p_actual_product_subtotal_cny, actual_product_subtotal_cny),
      actual_domestic_delivery_cny = coalesce(p_actual_domestic_delivery_cny, actual_domestic_delivery_cny),
      actual_discount_cny = coalesce(p_actual_discount_cny, actual_discount_cny),
      purchased_at = coalesce(p_purchased_at, purchased_at, v_result.synced_at)
  where id = v_result.provider_order_record_id
  returning * into v_provider_order;

  select * into v_order from public.order_items where id = p_order_item_id for update;
  if v_tracking_number is not null and v_order.status = 'purchased' then
    v_order := private.change_order_status_internal(
      p_order_item_id, 'seller_shipped', 'seller tracking recorded by provider sync'
    );
  end if;

  if v_batch_id is not null then
    update public.purchase_batch_items set status = 'purchased'
    where purchase_batch_id = v_batch_id and order_item_id = p_order_item_id;
    update public.purchase_batches
    set status = case when exists (
      select 1 from public.purchase_batch_items
      where purchase_batch_id = v_batch_id and status <> 'purchased'
    ) then 'partially_purchased'::public.purchase_batch_status else 'purchased'::public.purchase_batch_status end
    where id = v_batch_id;
  end if;

  return query select v_result.provider_order_record_id, v_order.status, v_result.synced_at,
    v_result.reservation_transaction_id, v_result.release_transaction_id, v_result.debit_transaction_id,
    v_result.debited_amount_cny, v_result.uncovered_amount_cny, v_result.applied_rate;
end;
$$;

commit;
