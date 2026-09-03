import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260829175156_retire_active_order_groups.sql";

test("new direct and estimate-confirmed orders retain null legacy group references", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create or replace function public\.confirm_multi_sku_order/);
  assert.match(migration, /create or replace function private\.accept_estimate_with_reservation_internal/);
  assert.doesNotMatch(migration, /insert into public\.order_groups/i);
  assert.doesNotMatch(migration, /create_or_get_active_order_group_internal/);
  assert.match(migration, /p_client_id, null, null, p_product_link_id/);
  assert.match(migration, /v_order\.id, null,\s*v_estimate\.product_link_id/);
  assert.match(migration, /'group_id', null, 'group_code', null/);
});

test("active client order screens do not present group assignments", async () => {
  const [resolver, productDetail, orders, estimateReview, shell] = await Promise.all([
    readFile("components/client/order-link-resolver.tsx", "utf8"),
    readFile("components/client/product-detail-buying-interface.tsx", "utf8"),
    readFile("app/client/orders/page.tsx", "utf8"),
    readFile("components/client/estimate-review.tsx", "utf8"),
    readFile("components/client/client-shell.tsx", "utf8"),
  ]);

  assert.doesNotMatch(resolver, /active order group|saved under group/i);
  assert.doesNotMatch(productDetail, /group not returned/i);
  assert.doesNotMatch(orders, /order_groups:group_id|group_code/);
  assert.doesNotMatch(estimateReview, /Order group/);
  assert.doesNotMatch(shell, /"Groups"/);
});
