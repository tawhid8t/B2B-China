begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(
    v_definition,
    'coalesce(sku_attributes->>''color'', sku_attributes->>''Color'')',
    'coalesce(sku_attributes->>''color'', sku_attributes->>''Color'', sku_attributes->>''颜色'')'
  );
  v_definition := replace(
    v_definition,
    'coalesce(sku_attributes->>''size'', sku_attributes->>''Size'')',
    'coalesce(sku_attributes->>''size'', sku_attributes->>''Size'', sku_attributes->>''尺码'', sku_attributes->>''尺寸'', sku_attributes->>''产品规格'')'
  );
  execute v_definition;
end;
$$;

commit;
