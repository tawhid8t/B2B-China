begin;
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, '        pl.images as product_images,' || chr(10), '        pl.images as product_images,' || chr(10) || '        pl.original_url as product_url,' || chr(10));
  v_definition := replace(v_definition, '        max(product_images) as product_images,' || chr(10), '        max(product_images) as product_images,' || chr(10) || '        max(product_url) as product_url,' || chr(10));
  v_definition := replace(v_definition, '''imageUrl'', product_images[1],', '''imageUrl'', product_images[1],' || chr(10) || '          ''productUrl'', product_url,');
  execute v_definition;
end; $$;
commit;
