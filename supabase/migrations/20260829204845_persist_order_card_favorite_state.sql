begin;
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, '''active'', false,', '''active'', exists (select 1 from public.client_favorites f where f.source_order_item_id = (skus->0->>''id'')::uuid and f.status = ''active''),');
  v_definition := replace(v_definition, '''favoriteId'', null', '''favoriteId'', (select f.id from public.client_favorites f where f.source_order_item_id = (skus->0->>''id'')::uuid and f.status = ''active'' limit 1)');
  execute v_definition;
end; $$;
commit;
