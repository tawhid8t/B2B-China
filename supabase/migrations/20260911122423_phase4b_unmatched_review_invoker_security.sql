-- Admin RLS policies already authorize the rows used here. Avoid a broader
-- SECURITY DEFINER capability for the two authenticated review RPCs.
alter function public.get_cainiao_unmatched_link_candidates() security invoker;
alter function public.link_cainiao_unmatched_parcel(text, uuid, text) security invoker;
