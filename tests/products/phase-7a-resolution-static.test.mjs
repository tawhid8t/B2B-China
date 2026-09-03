import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const route = read("app/api/products/resolve-link/route.ts");
const repository = read("services/supabase-product-repository.ts");
const migration = read("supabase/migrations/20260903162307_optimize_product_snapshot_persistence.sql");

test("resolve-link exposes retryable provider failures separately from manual review", () => {
  assert.match(route, /error\.kind === "lookup_failed"\) return apiError\("PROVIDER_LOOKUP_FAILED"/);
  assert.match(route, /apiSuccess\(data, resolutionMeta\)/);
});

test("product and SKU persistence uses one restricted atomic RPC", () => {
  const persistenceSection = repository.slice(repository.indexOf("async persistSnapshot"), repository.indexOf("async findFreshSnapshot"));
  assert.match(persistenceSection, /\.rpc\("persist_product_snapshot"/);
  assert.doesNotMatch(persistenceSection, /for \(const skuRecord/);
  assert.match(migration, /security invoker/i);
  assert.match(migration, /on conflict \(product_link_id, provider_sku_id\)/i);
  assert.match(migration, /revoke execute on function public\.persist_product_snapshot\(uuid, jsonb\) from public, anon, authenticated/i);
  assert.match(migration, /grant execute on function public\.persist_product_snapshot\(uuid, jsonb\) to service_role/i);
});

test("persisted fallback is constrained to provider identity, active status, and a caller supplied freshness cutoff", () => {
  assert.match(repository, /\.eq\("provider", provider\)/);
  assert.match(repository, /\.eq\("provider_item_id", providerItemId\)/);
  assert.match(repository, /\.eq\("source_status", "active"\)/);
  assert.match(repository, /\.gte\("updated_at", cutoff\)/);
  assert.match(repository, /if \(!productRow \|\| !isRealTitle\(productRow\.title\) \|\| !isImageList\(productRow\.images\)\) return null/);
  assert.match(repository, /if \(!skuRows\?\.length/);
});

test("snapshot lookup returns normalized fields only and never selects a raw provider payload", () => {
  const fallbackSection = repository.slice(repository.indexOf("async findFreshSnapshot"), repository.indexOf("async completeAttempt"));
  assert.doesNotMatch(fallbackSection, /raw_payload/);
  assert.match(fallbackSection, /skuId: String\(sku\.id\)/);
});
