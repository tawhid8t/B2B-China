import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("estimate persistence populates normalized and legacy SKU identifiers", async () => {
  const source = await readFile("services/supabase-estimate-repository.ts", "utf8");
  const mapperStart = source.indexOf("function mapEstimateRecord");
  const mapper = source.slice(mapperStart);

  assert.ok(mapperStart > -1);
  assert.match(mapper, /product_sku_id:\s*input\.skuId/);
  assert.match(mapper, /sku_id:\s*input\.skuId/);
});
