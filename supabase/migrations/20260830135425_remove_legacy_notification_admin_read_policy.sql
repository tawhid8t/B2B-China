-- The hardened MVP migration introduced this policy after the initial policy.
-- Phase 6 inboxes are recipient-only, including for admin recipients.
drop policy if exists notifications_select_own_or_admin on public.notifications;
