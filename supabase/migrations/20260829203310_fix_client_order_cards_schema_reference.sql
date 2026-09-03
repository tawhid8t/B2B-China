begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, '        oi.product_original_url,' || chr(10), '');
  execute v_definition;
end;
$$;

commit;
