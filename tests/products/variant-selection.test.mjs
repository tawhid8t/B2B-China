import assert from "node:assert/strict";
import test from "node:test";
import { getDisplayVariantLabel, getMatchingVariantSkus, getResolvedVariantSku, getVariantAttributeGroups, getVariantOptionState, translateVariantAttributeName, translateVariantValue } from "../../lib/product-variant-selection.ts";

const skus = [
  { skuId: "red-36", attributes: { Color: "Red", Size: "36" }, availableQuantity: 12 },
  { skuId: "red-37", attributes: { Color: "Red", Size: "37" }, availableQuantity: 0 },
  { skuId: "blue-36", attributes: { Color: "Blue", Size: "36" }, availableQuantity: 4 },
];

test("derives selectable variant groups and resolves valid combinations", () => {
  assert.deepEqual(getVariantAttributeGroups(skus), { Color: ["Red", "Blue"], Size: ["36", "37"] });
  assert.equal(getResolvedVariantSku(skus, { Color: "Red", Size: "36" }, ["Color", "Size"])?.skuId, "red-36");
  assert.equal(getResolvedVariantSku(skus, { Color: "Red" }, ["Color", "Size"]), undefined);
});

test("marks impossible and unavailable combinations without selecting them", () => {
  assert.equal(getVariantOptionState(skus, { Color: "Blue" }, "Size", "37"), "impossible");
  assert.equal(getVariantOptionState(skus, { Color: "Red" }, "Size", "37"), "unavailable");
  assert.equal(getVariantOptionState(skus, { Color: "Red" }, "Size", "36"), "available");
  assert.deepEqual(getMatchingVariantSkus(skus, { Color: "Blue", Size: "" }).map((sku) => sku.skuId), ["blue-36"]);
});

test("translates common option labels and color names for display only", () => {
  assert.equal(translateVariantAttributeName("颜色"), "Color");
  assert.equal(translateVariantAttributeName("尺寸"), "Size");
  assert.equal(translateVariantValue("红色"), "Red");
  assert.equal(translateVariantValue("蓝色"), "Blue");
  assert.equal(translateVariantValue("红色心形50只/盒"), "Red 心形50只/盒");
  assert.equal(getDisplayVariantLabel({ skuId: "x", label: "unused", attributes: { "颜色": "红色", "尺寸": "36" } }), "Red / 36");
});
