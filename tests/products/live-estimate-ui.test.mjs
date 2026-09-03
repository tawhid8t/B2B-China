import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PRODUCT_DETAIL_PATH = "components/client/product-detail-buying-interface.tsx";

test("product page uses local live calculation before confirm order", async () => {
  const source = await readFile(PRODUCT_DETAIL_PATH, "utf8");
  const updateQuantityStart = source.indexOf("const updateQuantity");
  const confirmOrderStart = source.indexOf("async function confirmOrder");
  const liveEstimateStart = source.indexOf("const liveEstimate");

  assert.ok(updateQuantityStart > -1);
  assert.ok(confirmOrderStart > updateQuantityStart);
  assert.ok(liveEstimateStart > -1 && liveEstimateStart < confirmOrderStart);
  assert.match(source.slice(liveEstimateStart, confirmOrderStart), /calculateLogisticsEstimate/);
  assert.doesNotMatch(source.slice(updateQuantityStart, confirmOrderStart), /fetch\(/);
  assert.match(source, /ShippingTariffSelector/);
  assert.match(source, /Review estimate/);
  assert.match(source, /Confirm order/);
  assert.match(source.slice(confirmOrderStart), /\/api\/orders\/confirm/);
  assert.match(source.slice(confirmOrderStart), /idempotencyKey/);
  assert.match(source.slice(confirmOrderStart), /lines: selectedLines\.map/);
  assert.match(source.slice(confirmOrderStart), /getApiErrorMessage/);
  assert.doesNotMatch(source.slice(confirmOrderStart), /\/api\/estimates/);
  assert.doesNotMatch(source, /current backend can confirm only one SKU/);
});

test("product page does not keep the old pre-confirm estimate request action", async () => {
  const source = await readFile(PRODUCT_DETAIL_PATH, "utf8");

  assert.doesNotMatch(source, /Get Estimate/);
  assert.doesNotMatch(source, /requestEstimate/);
});
