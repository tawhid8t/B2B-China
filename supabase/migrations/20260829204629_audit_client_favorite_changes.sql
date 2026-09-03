begin;
create or replace function private.audit_client_favorite_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.write_audit_log_internal('client_favorite', coalesce(new.id, old.id), case when tg_op='INSERT' then 'favorite_created' else 'favorite_archived' end, case when tg_op='INSERT' then null else to_jsonb(old) end, case when tg_op='INSERT' then to_jsonb(new) else to_jsonb(new) end, null);
  if tg_op = 'INSERT' then return new; end if;
  return old;
end; $$;
create trigger client_favorites_audit_insert after insert on public.client_favorites for each row execute function private.audit_client_favorite_change();
create trigger client_favorites_audit_update after update of status on public.client_favorites for each row when (old.status is distinct from new.status) execute function private.audit_client_favorite_change();
commit;
