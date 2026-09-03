begin;
do $$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_client_order_cards()'::regprocedure) into v_definition;
  v_definition := replace(v_definition, '        oi.client_notes,' || chr(10), '        oi.client_notes,' || chr(10) || '        coalesce(nullif(oi.cost_snapshot #>> ''{inputs,exchangeRateCnyToBdt}'', '''')::numeric, est.exchange_rate_cny_to_bdt) as exchange_rate,' || chr(10));
  v_definition := replace(v_definition, '      left join public.product_skus ps on ps.id = oi.product_sku_id' || chr(10), '      left join public.product_skus ps on ps.id = oi.product_sku_id' || chr(10) || '      left join public.estimates est on est.id = oi.estimate_id' || chr(10));
  v_definition := replace(v_definition, '        coalesce(sum(actual_total_bdt), sum(estimated_total_bdt)) as total_amount_bdt,', '        sum(case when exchange_rate is not null then coalesce(sku_price_cny, cny_price) * quantity * exchange_rate end) as supplier_total_bdt,' || chr(10) || '        sum(case when exchange_rate is not null then domestic_delivery_cny * exchange_rate + coalesce(international_shipping_bdt, 0) end) as shipping_total_bdt,' || chr(10) || '        sum(case when exchange_rate is not null then (coalesce(sku_price_cny, cny_price) * quantity + domestic_delivery_cny) * exchange_rate + coalesce(international_shipping_bdt, 0) end) as total_amount_bdt,');
  v_definition := replace(v_definition, '''subtotalCny'', round(coalesce(sku_price_cny, cny_price) * quantity, 2),', '''subtotalBdt'', case when exchange_rate is not null then round(coalesce(sku_price_cny, cny_price) * quantity * exchange_rate, 2) end,');
  v_definition := replace(v_definition, '          ''shippingFeeCny'', domestic_delivery_cny,' || chr(10) || '          ''shippingFeeBdt'', international_shipping_bdt,' || chr(10), '');
  v_definition := replace(v_definition, '        ''totalAmountBdt'', total_amount_bdt,', '        ''supplierTotalBdt'', supplier_total_bdt,' || chr(10) || '        ''shippingTotalBdt'', shipping_total_bdt,' || chr(10) || '        ''totalAmountBdt'', total_amount_bdt,');
  execute v_definition;
end; $$;
commit;
