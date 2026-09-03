-- Avoid a parcels <-> parcel_items policy dependency cycle. Every current MVP
-- parcel retains its owning order_item_id, so client ownership is resolved
-- directly through that indexed order row.
alter policy parcels_select_own_client
on public.parcels
using (
  (select public.current_user_role()) = 'client'
  and order_item_id in (
    select id from public.order_items
    where client_id in (select id from public.clients where profile_id = (select auth.uid()))
  )
);
