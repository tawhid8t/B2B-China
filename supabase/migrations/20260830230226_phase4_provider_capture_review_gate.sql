begin;
create table public.provider_purchase_captures (
 id uuid primary key default gen_random_uuid(), purchase_task_id uuid not null references public.purchase_tasks(id) on delete restrict,
 provider_order_id text not null, seller_name text, purchased_at timestamptz, domestic_delivery_cny numeric(14,2) not null default 0 check (domestic_delivery_cny >= 0), discount_cny numeric(14,2) not null default 0 check (discount_cny >= 0), final_paid_cny numeric(14,2) not null check (final_paid_cny > 0), raw_capture jsonb not null default '{}'::jsonb, captured_by uuid not null references public.profiles(id), created_at timestamptz not null default now());
create table public.provider_purchase_capture_lines (id uuid primary key default gen_random_uuid(), capture_id uuid not null references public.provider_purchase_captures(id) on delete restrict, order_item_id uuid not null references public.order_items(id), provider_sku_id text, quantity integer not null check(quantity>0), actual_unit_price_cny numeric(14,2) not null check(actual_unit_price_cny>=0), actual_subtotal_cny numeric(14,2) not null check(actual_subtotal_cny>=0), unique(capture_id, order_item_id));
alter table public.provider_purchase_captures enable row level security; alter table public.provider_purchase_capture_lines enable row level security;
create policy provider_purchase_captures_admin on public.provider_purchase_captures for all to authenticated using ((select public.current_user_role()) in ('admin','super_admin')) with check ((select public.current_user_role()) in ('admin','super_admin'));
create policy provider_purchase_capture_lines_admin on public.provider_purchase_capture_lines for all to authenticated using ((select public.current_user_role()) in ('admin','super_admin')) with check ((select public.current_user_role()) in ('admin','super_admin'));

create or replace function public.record_provider_purchase_capture(p_purchase_task_id uuid, p_header jsonb, p_lines jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_task public.purchase_tasks%rowtype; v_capture uuid; v_ids uuid[]; v_expected uuid[]; v_line jsonb; v_subtotal numeric; v_final numeric;
begin
 if (select auth.uid()) is null or public.current_user_role() not in ('admin','super_admin') then raise exception using errcode='42501', message='admin role required'; end if;
 select * into v_task from public.purchase_tasks where id=p_purchase_task_id for update; if not found or v_task.state not in ('cart_added','awaiting_provider_details','needs_review') then raise exception using errcode='23514', message='task is not ready for provider capture'; end if;
 select array_agg(id order by id) into v_expected from public.order_items where product_order_id=v_task.product_order_id and status='queued_for_purchase';
 select array_agg((value->>'orderItemId')::uuid order by (value->>'orderItemId')::uuid) into v_ids from jsonb_array_elements(p_lines);
 if v_expected is distinct from v_ids then raise exception using errcode='23514', message='capture must uniquely match every queued SKU line'; end if;
 select coalesce(sum((value->>'actualSubtotalCny')::numeric),0) into v_subtotal from jsonb_array_elements(p_lines);
 v_final := (p_header->>'finalPaidCny')::numeric;
 if abs(v_final - (v_subtotal - coalesce((p_header->>'discountCny')::numeric,0) + coalesce((p_header->>'domesticDeliveryCny')::numeric,0))) > .01 then raise exception using errcode='23514', message='final paid total does not reconcile to captured SKU lines'; end if;
 insert into public.provider_purchase_captures(purchase_task_id,provider_order_id,seller_name,purchased_at,domestic_delivery_cny,discount_cny,final_paid_cny,raw_capture,captured_by) values(v_task.id,p_header->>'providerOrderId',nullif(p_header->>'sellerName',''),nullif(p_header->>'purchasedAt','')::timestamptz,coalesce((p_header->>'domesticDeliveryCny')::numeric,0),coalesce((p_header->>'discountCny')::numeric,0),v_final,coalesce(p_header->'rawCapture','{}'::jsonb),auth.uid()) returning id into v_capture;
 for v_line in select value from jsonb_array_elements(p_lines) loop insert into public.provider_purchase_capture_lines(capture_id,order_item_id,provider_sku_id,quantity,actual_unit_price_cny,actual_subtotal_cny) values(v_capture,(v_line->>'orderItemId')::uuid,nullif(v_line->>'providerSkuId',''),(v_line->>'quantity')::int,(v_line->>'actualUnitPriceCny')::numeric,(v_line->>'actualSubtotalCny')::numeric); end loop;
 update public.purchase_tasks set state='awaiting_admin_confirmation',last_error=null where id=v_task.id;
 return v_capture;
end; $$;
revoke all on function public.record_provider_purchase_capture(uuid,jsonb,jsonb) from public,anon; grant execute on function public.record_provider_purchase_capture(uuid,jsonb,jsonb) to authenticated,service_role;
create or replace function public.record_provider_purchase_capture_for_credential(p_profile_id uuid,p_purchase_task_id uuid,p_header jsonb,p_lines jsonb) returns uuid language plpgsql security definer set search_path='' as $$ begin perform set_config('request.jwt.claim.sub',p_profile_id::text,true); return public.record_provider_purchase_capture(p_purchase_task_id,p_header,p_lines); end; $$;
revoke all on function public.record_provider_purchase_capture_for_credential(uuid,uuid,jsonb,jsonb) from public,anon,authenticated; grant execute on function public.record_provider_purchase_capture_for_credential(uuid,uuid,jsonb,jsonb) to service_role;
commit;
