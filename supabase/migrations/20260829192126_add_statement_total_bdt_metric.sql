-- Add the all-filtered-rows BDT total to the existing client statement chart.
-- Reusing the deployed function definition keeps this additive and avoids
-- duplicating its ownership and calculation logic.
begin;

do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(
    'public.get_client_product_statement(integer,date,date,date,text,public.order_status)'::regprocedure
  ) into v_definition;

  v_definition := replace(
    v_definition,
    '''totalWeightKg'', (select sum(total_weight_kg) from grouped),',
    '''totalWeightKg'', (select sum(total_weight_kg) from grouped),
        ''totalBdt'', coalesce((select sum(total_bdt) from grouped), 0),'
  );

  execute v_definition;
end;
$$;

commit;
