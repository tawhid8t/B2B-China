-- Forward-only replacement removing the redundant declaration shadowed by the
-- integer FOR-loop variable. Behavior is unchanged.
create or replace function private.create_or_get_active_order_group_internal(
  p_client_id uuid
)
returns public.order_groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_role public.user_role;
  v_group public.order_groups%rowtype;
  v_open_count integer;
begin
  if v_actor is null then
    raise exception using errcode = '42501', message = 'authentication required';
  end if;

  select p.role into v_role
  from public.profiles p
  where p.id = v_actor;

  if v_role not in ('admin', 'super_admin')
     and not exists (
       select 1
       from public.clients c
       where c.id = p_client_id
         and c.profile_id = v_actor
     ) then
    raise exception using errcode = '42501', message = 'client access denied';
  end if;

  perform 1
  from public.clients c
  where c.id = p_client_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'client not found';
  end if;

  select count(*)::integer
  into v_open_count
  from public.order_groups og
  where og.client_id = p_client_id
    and og.status = 'open';

  if v_open_count > 1 then
    raise exception using errcode = 'P0003', message = 'multiple open order groups require manual resolution';
  end if;

  if v_open_count = 1 then
    select *
    into v_group
    from public.order_groups og
    where og.client_id = p_client_id
      and og.status = 'open'
    for update;

    if v_group.fulfilled_item_count < private.order_group_fulfilled_limit() then
      return v_group;
    end if;

    perform private.close_group_if_fulfilled_limit_reached_internal(v_group.id);
  end if;

  for v_attempt in 1..5 loop
    begin
      insert into public.order_groups (client_id, group_code, status)
      values (
        p_client_id,
        'GRP-' || to_char(current_date, 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        'open'
      )
      returning * into v_group;

      return v_group;
    exception
      when unique_violation then
        if v_attempt = 5 then
          raise;
        end if;
    end;
  end loop;

  raise exception using errcode = 'P0001', message = 'unable to allocate a unique order group code';
end;
$$;
