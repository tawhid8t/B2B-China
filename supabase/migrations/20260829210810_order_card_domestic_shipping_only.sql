begin;
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, '''subtotalBdt'', case when exchange_rate is not null then round(coalesce(sku_price_cny, cny_price) * quantity * exchange_rate, 2) end,', '''subtotalCny'', round(coalesce(sku_price_cny, cny_price) * quantity, 2),' || chr(10) || '          ''subtotalBdt'', case when exchange_rate is not null then round(coalesce(sku_price_cny, cny_price) * quantity * exchange_rate, 2) end,');
  v_definition := replace(v_definition, '        sum(case when exchange_rate is not null then coalesce(sku_price_cny, cny_price) * quantity * exchange_rate end) as supplier_total_bdt,' || chr(10) || '        sum(case when exchange_rate is not null then domestic_delivery_cny * exchange_rate + coalesce(international_shipping_bdt, 0) end) as shipping_total_bdt,' || chr(10) || '        sum(case when exchange_rate is not null then (coalesce(sku_price_cny, cny_price) * quantity + domestic_delivery_cny) * exchange_rate + coalesce(international_shipping_bdt, 0) end) as total_amount_bdt,', '        sum(coalesce(sku_price_cny, cny_price) * quantity) as supplier_total_cny,' || chr(10) || '        sum(case when exchange_rate is not null then coalesce(sku_price_cny, cny_price) * quantity * exchange_rate end) as supplier_total_bdt,' || chr(10) || '        sum(domestic_delivery_cny) as shipping_total_cny,' || chr(10) || '        sum(case when exchange_rate is not null then domestic_delivery_cny * exchange_rate end) as shipping_total_bdt,' || chr(10) || '        sum(case when exchange_rate is not null then (coalesce(sku_price_cny, cny_price) * quantity + domestic_delivery_cny) * exchange_rate end) as total_amount_bdt,');
  v_definition := replace(v_definition, '''supplierTotalBdt'', supplier_total_bdt,', '''supplierTotalCny'', supplier_total_cny,' || chr(10) || '        ''supplierTotalBdt'', supplier_total_bdt,');
  v_definition := replace(v_definition, '''shippingTotalBdt'', shipping_total_bdt,', '''shippingTotalCny'', shipping_total_cny,' || chr(10) || '        ''shippingTotalBdt'', shipping_total_bdt,');
  execute v_definition;
end; $$;
commit;
