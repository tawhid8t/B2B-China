import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("product statement derives client ownership and limits data to safe aggregates", async () => {
  const [migration, metricMigration, route, service] = await Promise.all([
    readFile("supabase/migrations/20260829183641_add_client_product_statement_api.sql", "utf8"),
    readFile("supabase/migrations/20260829192126_add_statement_total_bdt_metric.sql", "utf8"),
    readFile("app/api/client/product-statement/route.ts", "utf8"),
    readFile("services/client-product-statement-service.ts", "utf8"),
  ]);

  assert.match(migration, /where c\.profile_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /f\.client_id = v_client_id/);
  assert.match(migration, /offset \(\(p_page - 1\) \* 30\) limit 30/);
  assert.match(migration, /p_start_date|p_end_date|p_month|p_category|p_status/);
  assert.match(migration, /mixed_progress/);
  assert.match(metricMigration, /totalBdt/);
  assert.match(migration, /revoke all on function public\.get_client_product_statement/);
  assert.doesNotMatch(migration, /p_client_id/);
  assert.match(route, /CLIENT_OPERATION_ROLES/);
  assert.match(route, /pageSize: 30/);
  assert.match(route, /startDate|endDate|month|category|status/);
  assert.match(service, /get_client_product_statement/);
  assert.match(service, /totalBdt/);
  assert.doesNotMatch(service, /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
});

test("product statement detail derives client ownership and exposes normalized submission facts only", async () => {
  const [migration, route, service, detail] = await Promise.all([
    readFile("supabase/migrations/20260903184834_add_client_product_statement_detail.sql", "utf8"),
    readFile("app/api/client/product-statement/[productLinkId]/route.ts", "utf8"),
    readFile("services/client-product-statement-detail-service.ts", "utf8"),
    readFile("components/client/client-product-statement-detail.tsx", "utf8"),
  ]);
  assert.match(migration, /get_client_product_statement_detail/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /po\.client_id = v_client_id/);
  assert.match(migration, /revoke all on function public\.get_client_product_statement_detail\(uuid\) from public, anon/);
  assert.match(migration, /grant execute on function public\.get_client_product_statement_detail\(uuid\) to authenticated/);
  assert.doesNotMatch(migration, /select[\s\S]*(raw_provider_payload|provider_credentials)/i);
  assert.match(route, /authorizeApiRequest/);
  assert.match(route, /NOT_FOUND/);
  assert.match(service, /get_client_product_statement_detail/);
  assert.match(detail, /Order submissions/);
  assert.match(detail, /skuLines/);
  assert.match(detail, /Saved rate/);
});
