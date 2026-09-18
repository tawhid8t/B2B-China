-- A provider capture is evidence only until an administrator approves it.
-- Approval applies every SKU in the product order together and commits the
-- captured, allocated supplier cost through the existing wallet-safe sync.
create or replace function public.approve_provider_purchase_capture(p_purchase_task_id uuid, p_note text default null)
returns table (purchase_task_id uuid, purchase_task_state text, provider_capture_id uuid, approved_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_task public.purchase_tasks%rowtype; v_capture public.provider_purchase_captures%rowtype; v_line public.provider_purchase_capture_lines%rowtype; v_expected uuid[]; v_captured uuid[]; v_subtotal numeric; v_allocated_final numeric := 0; v_allocated_delivery numeric := 0; v_allocated_discount numeric := 0; v_item_count integer; v_index integer := 0; v_line_final numeric; v_line_delivery numeric; v_line_discount numeric; v_before jsonb; v_sync record;
begin
 if (select auth.uid()) is null or public.current_user_role() not in ('admin','super_admin') then raise exception using errcode='42501', message='admin role required'; end if;
 select * into v_task from public.purchase_tasks where id=p_purchase_task_id for update;
 if not found then raise exception using errcode='P0002', message='purchase task not found'; end if;
 if v_task.state <> 'awaiting_admin_confirmation' then raise exception using errcode='23514', message='provider capture is not awaiting approval'; end if;
 select * into v_capture from public.provider_purchase_captures pc where pc.purchase_task_id=v_task.id order by pc.created_at desc limit 1 for update;
 if not found then raise exception using errcode='P0002', message='provider capture not found'; end if;
 select array_agg(id order by id) into v_expected from public.order_items where product_order_id=v_task.product_order_id and status='queued_for_purchase';
 select array_agg(order_item_id order by order_item_id), coalesce(sum(actual_subtotal_cny),0), count(*) into v_captured, v_subtotal, v_item_count from public.provider_purchase_capture_lines where capture_id=v_capture.id;
 if v_expected is distinct from v_captured or v_item_count = 0 or v_subtotal <= 0 then raise exception using errcode='23514', message='captured provider lines no longer match every queued SKU'; end if;
 v_before := jsonb_build_object('task',to_jsonb(v_task),'capture',to_jsonb(v_capture));
 for v_line in select * from public.provider_purchase_capture_lines where capture_id=v_capture.id order by order_item_id loop
   v_index := v_index + 1;
   v_line_final := case when v_index=v_item_count then v_capture.final_paid_cny-v_allocated_final else round(v_capture.final_paid_cny*v_line.actual_subtotal_cny/v_subtotal,2) end;
   v_line_delivery := case when v_index=v_item_count then v_capture.domestic_delivery_cny-v_allocated_delivery else round(v_capture.domestic_delivery_cny*v_line.actual_subtotal_cny/v_subtotal,2) end;
   v_line_discount := case when v_index=v_item_count then v_capture.discount_cny-v_allocated_discount else round(v_capture.discount_cny*v_line.actual_subtotal_cny/v_subtotal,2) end;
   v_allocated_final := v_allocated_final+v_line_final; v_allocated_delivery := v_allocated_delivery+v_line_delivery; v_allocated_discount := v_allocated_discount+v_line_discount;
   select * into v_sync from public.sync_provider_order_and_commit_wallet_v2(v_line.order_item_id,'alibaba1688',v_capture.provider_order_id,v_line_final,null,'purchased',jsonb_build_object('provider_capture_id',v_capture.id,'capture_raw',v_capture.raw_capture),null,v_task.purchase_batch_id,v_line.provider_sku_id,v_line.quantity,v_line.actual_unit_price_cny,v_line.actual_subtotal_cny,v_line_delivery,v_line_discount,v_capture.purchased_at);
 end loop;
 update public.purchase_tasks set state='confirmed',last_error=null,updated_at=now() where id=v_task.id;
 perform private.write_audit_log_internal('purchase_task',v_task.id,'provider_capture_approved',v_before,jsonb_build_object('purchase_task_state','confirmed','provider_capture_id',v_capture.id,'final_paid_cny',v_capture.final_paid_cny),p_note);
 return query select v_task.id,'confirmed'::text,v_capture.id,now();
end; $$;
revoke all on function public.approve_provider_purchase_capture(uuid,text) from public,anon;
grant execute on function public.approve_provider_purchase_capture(uuid,text) to authenticated,service_role;

create or replace function public.return_provider_capture_to_review(p_purchase_task_id uuid, p_reason text)
returns table (purchase_task_id uuid, purchase_task_state text, updated_at timestamptz)
language plpgsql security invoker set search_path = '' as $$
declare v_task public.purchase_tasks%rowtype; v_before jsonb;
begin
 if (select auth.uid()) is null or public.current_user_role() not in ('admin','super_admin') then raise exception using errcode='42501', message='admin role required'; end if;
 if nullif(btrim(p_reason),'') is null then raise exception using errcode='22023', message='a review reason is required'; end if;
 select * into v_task from public.purchase_tasks where id=p_purchase_task_id for update;
 if not found then raise exception using errcode='P0002', message='purchase task not found'; end if;
 if v_task.state <> 'awaiting_admin_confirmation' then raise exception using errcode='23514', message='provider capture is not awaiting approval'; end if;
 v_before := to_jsonb(v_task);
 update public.purchase_tasks set state='needs_review',last_error=btrim(p_reason),updated_at=now() where id=v_task.id;
 perform private.write_audit_log_internal('purchase_task',v_task.id,'provider_capture_returned_to_review',v_before,jsonb_build_object('purchase_task_state','needs_review'),p_reason);
 return query select v_task.id,'needs_review'::text,now();
end; $$;
revoke all on function public.return_provider_capture_to_review(uuid,text) from public,anon;
grant execute on function public.return_provider_capture_to_review(uuid,text) to authenticated,service_role;
