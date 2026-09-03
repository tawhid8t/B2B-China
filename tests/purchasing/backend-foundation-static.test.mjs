import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = "supabase/migrations/20260828090506_purchasing_backend_foundation.sql";
const lifecycleMigration = "supabase/migrations/20260828093531_fix_provider_sync_tracking_lifecycle.sql";

test("purchasing migration queues confirmed orders and preserves status-machine enforcement", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create or replace function public\.queue_order_for_purchase/);
  assert.match(sql, /only confirmed orders can be queued for purchase/);
  assert.match(sql, /private\.change_order_status_internal\(v_order\.id, 'queued_for_purchase'/);
});

test("purchase queue returns only eligible queued items with existing snapshot fields", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create or replace function public\.get_extension_purchase_queue/);
  assert.match(sql, /oi\.status = 'queued_for_purchase'/);
  assert.match(sql, /pbi\.status = 'queued'/);
  assert.match(sql, /pl\.original_url/);
  assert.match(sql, /oi\.cny_price/);
});

test("provider sync is idempotent and stores actual purchase values without rewriting estimates", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /provider_sku_id text/);
  assert.match(sql, /actual_product_subtotal_cny numeric/);
  assert.match(sql, /purchased_at timestamptz/);
  assert.match(sql, /public\.sync_provider_order_and_commit_wallet_v2/);
  assert.match(sql, /update public\.provider_orders set purchase_batch_id/);
  assert.doesNotMatch(sql, /update public\.(estimates|product_links)\s+set/i);
});

test("extension endpoints require server-derived admin authorization and use the API envelope", async () => {
  const [queue, sync] = await Promise.all([
    readFile("app/api/extension/purchase-queue/route.ts", "utf8"),
    readFile("app/api/extension/provider-order-sync/route.ts", "utf8"),
  ]);
  assert.match(queue, /authorizeExtensionApiRequest/);
  assert.match(queue, /apiSuccess/);
  assert.match(queue, /get_extension_purchase_queue_v2_for_credential/);
  assert.match(queue, /productOrderId/);
  assert.match(queue, /purchaseTaskId/);
  assert.match(queue, /skus:/);
  assert.match(queue, /"INTERNAL_ERROR"/);
  assert.doesNotMatch(queue, /"PROVIDER_SYNC_FAILED"/);
  assert.match(sync, /authorizeExtensionApiRequest/);
  assert.match(sync, /actualUnitPriceCny/);
  assert.doesNotMatch(sync, /actorId|clientId/);
});

test("cart-result endpoint persists extension progress without provider purchase finalization", async () => {
  const route = await readFile("app/api/extension/purchase-cart-result/route.ts", "utf8");
  assert.match(route, /record_purchase_task_cart_result/);
  assert.match(route, /authorizeExtensionApiRequest/);
  assert.match(route, /apiSuccess/);
  assert.doesNotMatch(route, /syncProviderOrderAndCommitWallet/);
});

test("provider sync performs sequential purchase and seller-shipment transitions when tracking is present", async () => {
  const sql = await readFile(lifecycleMigration, "utf8");
  assert.match(sql, /private\.sync_provider_order_and_commit_wallet_internal\([\s\S]*?null, p_provider_status/);
  assert.match(sql, /v_tracking_number is not null and v_order\.status = 'purchased'/);
  assert.match(sql, /private\.change_order_status_internal\([\s\S]*?'seller_shipped'/);
  assert.match(sql, /return query select v_result\.provider_order_record_id, v_order\.status/);
});

test("provider sync is idempotent at the final seller-shipped status and rejects invalid lifecycle states", async () => {
  const sql = await readFile(lifecycleMigration, "utf8");
  assert.match(sql, /v_order\.status not in \('queued_for_purchase', 'purchased', 'seller_shipped'\)/);
  assert.match(sql, /v_order\.status = 'purchased'/);
  assert.match(sql, /null, p_provider_status, p_raw_payload/);
});
