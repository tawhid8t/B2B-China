import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const ROUTE_PATH = "app/api/orders/confirm/route.ts";
const SERVICE_PATH = "services/order-confirmation-service.ts";
const MIGRATION_PATH =
  "supabase/migrations/20260830095615_integrate_orders_with_partial_wallet_reservations.sql";

test("order confirmation route supports direct multi-SKU confirmation without removing legacy estimate accept", async () => {
  const route = await readFile(ROUTE_PATH, "utf8");

  assert.match(route, /directConfirmSchema/);
  assert.match(route, /lines:\s*z\s*\.array/);
  assert.match(route, /findShippingTariffByItem/);
  assert.match(route, /confirmMultiSkuOrder/);
  assert.match(route, /legacyConfirmSchema/);
  assert.match(route, /acceptEstimate/);
});

test("direct confirmation service uses server-side authorization and service-role RPC only", async () => {
  const service = await readFile(SERVICE_PATH, "utf8");

  assert.match(service, /createSupabaseAdminClient/);
  assert.match(service, /confirm_multi_sku_order/);
  assert.match(service, /\.from\("clients"\)/);
  assert.match(service, /profile_id/);
  assert.match(service, /\.from\("product_orders"\)/);
  assert.match(service, /\.eq\("client_id", clientId\)/);
  assert.match(service, /productOrderId: productOrder\.id/);
  assert.match(service, /orderNumber: productOrder\.order_number/);
  assert.match(service, /submittedAt: productOrder\.created_at/);
  assert.doesNotMatch(service, /NEXT_PUBLIC_SUPABASE_ANON_KEY/);
});

test("direct confirmation response adds the product submission identity without changing either request contract", async () => {
  const route = await readFile(ROUTE_PATH, "utf8");
  assert.match(route, /productOrderId: result\.productOrderId/);
  assert.match(route, /orderNumber: result\.orderNumber/);
  assert.match(route, /submittedAt: result\.submittedAt/);
  assert.match(route, /legacyConfirmSchema/);
  assert.match(route, /directConfirmSchema/);
});

test("direct confirmation keeps the review selection for recoverable failures and locks duplicate submissions", async () => {
  const ui = await readFile("components/client/product-detail-buying-interface.tsx", "utf8");
  assert.match(ui, /if \(confirmInFlight\.current\) return/);
  assert.match(ui, /setConfirmError\(/);
  assert.match(ui, /Network connection failed\. No financial action was retried automatically\./);
  const clearAfterSuccess = ui.indexOf("setSelection(clearProductSkuSelection())");
  const unsuccessfulResponse = ui.indexOf("if (!response.ok || !payload.data?.orderItems?.length)");
  assert.ok(clearAfterSuccess > unsuccessfulResponse);
});

test("direct confirmation stores snapshots and reserves only available product-cost funds", async () => {
  const migration = await readFile(MIGRATION_PATH, "utf8");

  assert.match(
    migration,
    /create or replace function public\.confirm_multi_sku_order/,
  );
  assert.match(migration, /jsonb_array_elements\(p_lines\)/);
  assert.match(migration, /product_cost_cny/);
  assert.match(migration, /service_charge_cny/);
  assert.match(migration, /china_to_guangzhou_cny/);
  assert.match(migration, /international_shipping_bdt/);
  assert.match(
    migration,
    /v_reserved := greatest\(least\(v_wallet_balance, v_line_product_cost\), 0\)/,
  );
  assert.match(
    migration,
    /v_uncovered := greatest\(v_line_product_cost - v_reserved, 0\)/,
  );
  assert.match(migration, /p_client_id, 'reservation'/);
  assert.match(migration, /wallet_required_cny/);
  assert.match(migration, /wallet_rate_cny_to_bdt/);
  assert.match(
    migration,
    /grant execute on function public\.confirm_multi_sku_order[\s\S]*to service_role/,
  );
  assert.match(
    migration,
    /revoke all on function public\.confirm_multi_sku_order[\s\S]*authenticated/,
  );
});
