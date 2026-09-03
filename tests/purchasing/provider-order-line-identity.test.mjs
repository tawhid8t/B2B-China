import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = "supabase/migrations/20260828190557_provider_order_line_identity.sql";

test("provider-order identity is line-aware while preserving historical rows", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /drop index if exists public\.provider_orders_provider_reference_key/);
  assert.match(sql, /create unique index provider_orders_provider_order_item_reference_key[\s\S]*\(provider, provider_order_id, order_item_id\)/);
  assert.match(sql, /where provider_order_id is not null/);
  assert.match(sql, /on conflict \(provider, provider_order_id, order_item_id\) where provider_order_id is not null/);
  assert.doesNotMatch(sql, /delete from public\.provider_orders/i);
});

test("same line is idempotent, different order items share a provider order safely, and conflicts fail", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /where public\.provider_orders\.paid_amount_cny = excluded\.paid_amount_cny/);
  assert.match(sql, /provider order line conflicts with an existing paid purchase/);
  assert.match(sql, /p_order_item_id, 'purchased', 'provider order and paid amount recorded'/);
  assert.match(sql, /p_order_item_id, 'seller_shipped', 'seller tracking recorded by provider sync'/);
});

test("one shared provider order can identify one, two, or five distinct BridgeCart lines", () => {
  const identity = (provider, providerOrderId, orderItemId) => `${provider}:${providerOrderId}:${orderItemId}`;
  assert.equal(new Set([identity("alibaba1688", "1688-ABC", "A")]).size, 1);
  assert.equal(new Set(["A", "B"].map((item) => identity("alibaba1688", "1688-ABC", item))).size, 2);
  assert.equal(new Set(["A", "B", "C", "D", "E"].map((item) => identity("alibaba1688", "1688-ABC", item))).size, 5);
  assert.notEqual(identity("alibaba1688", "1688-ABC", "A"), identity("taobao", "1688-ABC", "A"));
});
