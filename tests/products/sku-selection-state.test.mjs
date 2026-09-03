import assert from "node:assert/strict";
import test from "node:test";
import {
  EMPTY_PRODUCT_SKU_SELECTION,
  clearProductSkuSelection,
  getSelectedSkuLines,
  getSingleSkuEstimateSelection,
  getSupplierSelectionSummary,
  setSelectionFilter,
  setSkuSelectionQuantity,
} from "../../lib/product-sku-selection.ts";

const skus = [
  { skuId: "red-s", attributes: { Color: "Red", Size: "S" }, priceCny: 10.25, availableQuantity: 8, imageUrl: "red-s.jpg" },
  { skuId: "red-m", attributes: { Color: "Red", Size: "M" }, priceCny: 12.5, availableQuantity: 2, imageUrl: "red-m.jpg" },
  { skuId: "blue-m", attributes: { Color: "Blue", Size: "M" }, priceCny: 11, availableQuantity: 0, imageUrl: "blue-m.jpg" },
  { skuId: "green-l", attributes: { Color: "Green", Size: "L" }, priceCny: 9.99 },
];

test("starts empty, supports one or multiple canonical SKU quantities, and clears", () => {
  assert.deepEqual(getSelectedSkuLines(skus, EMPTY_PRODUCT_SKU_SELECTION), []);
  let state = setSkuSelectionQuantity(skus, EMPTY_PRODUCT_SKU_SELECTION, "red-s", 3);
  state = setSkuSelectionQuantity(skus, state, "green-l", 7);
  assert.deepEqual(getSelectedSkuLines(skus, state).map(({ sku, quantity }) => [sku.skuId, quantity]), [["red-s", 3], ["green-l", 7]]);
  assert.deepEqual(clearProductSkuSelection(), EMPTY_PRODUCT_SKU_SELECTION);
});

test("preserves existing quantities when changing color/size filters", () => {
  let state = setSkuSelectionQuantity(skus, EMPTY_PRODUCT_SKU_SELECTION, "red-s", 4);
  state = setSelectionFilter(state, "Color", "Blue");
  state = setSelectionFilter(state, "Size", "M");
  assert.equal(state.quantitiesBySkuId["red-s"], 4);
  assert.deepEqual(state.filters, { Color: "Blue", Size: "M" });
});

test("rejects out-of-stock quantities and clamps limited stock", () => {
  let state = setSkuSelectionQuantity(skus, EMPTY_PRODUCT_SKU_SELECTION, "blue-m", 1);
  assert.deepEqual(getSelectedSkuLines(skus, state), []);
  state = setSkuSelectionQuantity(skus, state, "red-m", 9);
  assert.deepEqual(getSelectedSkuLines(skus, state).map(({ sku, quantity }) => [sku.skuId, quantity]), [["red-m", 2]]);
});

test("calculates display-only supplier figures and permits estimate payloads only for one SKU", () => {
  let state = setSkuSelectionQuantity(skus, EMPTY_PRODUCT_SKU_SELECTION, "red-s", 3);
  assert.deepEqual(getSupplierSelectionSummary(skus, state, 8), { selectedSkuCount: 1, selectedPieces: 3, supplierSubtotalCny: 30.75, domesticDeliveryCny: 8 });
  assert.deepEqual(getSingleSkuEstimateSelection(skus, state), { sku: skus[0], quantity: 3 });
  state = setSkuSelectionQuantity(skus, state, "green-l", 1);
  assert.equal(getSingleSkuEstimateSelection(skus, state), null);
});

test("handles very large SKU lists without changing canonical selection", () => {
  const manySkus = Array.from({ length: 5000 }, (_, index) => ({ skuId: `sku-${index}`, attributes: { Color: `Color ${index}` }, priceCny: 1 }));
  const state = setSkuSelectionQuantity(manySkus, EMPTY_PRODUCT_SKU_SELECTION, "sku-4999", 2);
  assert.deepEqual(getSelectedSkuLines(manySkus, state).map(({ sku, quantity }) => [sku.skuId, quantity]), [["sku-4999", 2]]);
});
