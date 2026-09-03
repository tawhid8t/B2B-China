-- Seed the default CNY -> BDT exchange-rate configuration required for
-- Phase 6B order confirmation.
--
-- This does not change wallet rules or client-side financial authority:
-- server-side order/estimate routines still read the current historical
-- exchange-rate row and snapshot the rate used on each order. Admin/super
-- admin users can add newer configured rates later; old order snapshots must
-- remain unchanged.

insert into public.exchange_rates (
  cny_to_bdt,
  source,
  effective_on,
  created_by
)
values (
  19.2000,
  'system_default',
  date '2026-08-27',
  null
)
on conflict (effective_on, source) do nothing;
