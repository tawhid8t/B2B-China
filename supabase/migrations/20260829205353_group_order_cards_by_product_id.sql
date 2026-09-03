begin;
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, 'coalesce(nullif(s.provider_order_id, ''''), s.id::text) as order_key', 's.product_link_id::text as order_key');
  execute v_definition;
end; $$;
commit;
