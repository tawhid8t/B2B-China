import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateLogisticsEstimate,
} from "../../services/estimate-calculation-service.ts";
import {
  findShippingTariffByItem,
  listShippingTariffGroups,
} from "../../lib/shipping-tariffs.ts";

test("calculates the supplied Mouse tariff example", () => {
  const mouseTariff = findShippingTariffByItem("Mouse");

  assert.equal(mouseTariff?.rateBdtPerKg, 700);

  const result = calculateLogisticsEstimate({
    productId: "product-1",
    exchangeRate: "19.20",
    internationalShippingCategory: mouseTariff.item,
    internationalShippingRateBdtPerKg: mouseTariff.rateBdtPerKg,
    lines: [
      {
        skuId: "sku-1",
        unitPriceCny: "50.00",
        quantity: 2,
        unitWeightKg: "1.000",
      },
    ],
  });

  assert.deepEqual(result, {
    productBaseCostCny: "100.00",
    totalProductWeightKg: "2.000",
    chinaDomesticShippingCny: "8.00",
    chinaToGuangzhouCostCny: "8.00",
    serviceChargeCny: "6.00",
    totalCnyCost: "122.00",
    exchangeRate: "19.2000",
    convertedCnyCostBdt: "2343",
    internationalShippingCategory: "Mouse",
    internationalShippingRateBdtPerKg: "700.00",
    internationalShippingBdt: "1400.00",
    grandEstimatedTotalBdt: "3743.00",
  });
});

test("supports multiple SKUs from the same product with different quantities", () => {
  const result = calculateLogisticsEstimate({
    productId: "product-1",
    exchangeRate: "20",
    internationalShippingCategory: "Wallet",
    internationalShippingRateBdtPerKg: "750",
    lines: [
      { skuId: "black-m", unitPriceCny: "10.00", quantity: 3, unitWeightKg: "0.200" },
      { skuId: "black-l", unitPriceCny: "2.50", quantity: 4, unitWeightKg: "0.125" },
    ],
  });

  assert.equal(result.productBaseCostCny, "40.00");
  assert.equal(result.totalProductWeightKg, "1.100");
  assert.equal(result.chinaDomesticShippingCny, "4.40");
  assert.equal(result.chinaToGuangzhouCostCny, "4.40");
  assert.equal(result.serviceChargeCny, "2.40");
  assert.equal(result.totalCnyCost, "51.20");
  assert.equal(result.convertedCnyCostBdt, "1024");
  assert.equal(result.internationalShippingBdt, "825.00");
  assert.equal(result.grandEstimatedTotalBdt, "1849.00");
});

test("changing quantities and deselecting SKU lines changes totals immediately", () => {
  const baseInput = {
    productId: "product-1",
    exchangeRate: "20",
    internationalShippingCategory: "Keyboard",
    internationalShippingRateBdtPerKg: "700",
    lines: [
      { skuId: "red-m", unitPriceCny: "10.00", quantity: 1, unitWeightKg: "0.500" },
      { skuId: "blue-m", unitPriceCny: "20.00", quantity: 1, unitWeightKg: "0.500" },
      { skuId: "green-m", unitPriceCny: "30.00", quantity: 1, unitWeightKg: "0.500" },
    ],
  };

  const threeSkus = calculateLogisticsEstimate(baseInput);
  const changedQuantity = calculateLogisticsEstimate({
    ...baseInput,
    lines: [
      baseInput.lines[0],
      { ...baseInput.lines[1], quantity: 3 },
      baseInput.lines[2],
    ],
  });
  const deselectedSku = calculateLogisticsEstimate({
    ...baseInput,
    lines: [baseInput.lines[0], baseInput.lines[2]],
  });

  assert.equal(threeSkus.productBaseCostCny, "60.00");
  assert.equal(changedQuantity.productBaseCostCny, "100.00");
  assert.equal(changedQuantity.grandEstimatedTotalBdt, "4270.00");
  assert.equal(deselectedSku.productBaseCostCny, "40.00");
  assert.equal(deselectedSku.grandEstimatedTotalBdt, "1708.00");
});

test("preserves decimal precision for weights and prices", () => {
  const result = calculateLogisticsEstimate({
    productId: "product-1",
    exchangeRate: "3",
    internationalShippingCategory: "Custom decimal",
    internationalShippingRateBdtPerKg: "0.10",
    lines: [
      { skuId: "sku-a", unitPriceCny: "0.10", quantity: 3, unitWeightKg: "0.100" },
      { skuId: "sku-b", unitPriceCny: "0.333", quantity: 2, unitWeightKg: "0.075" },
    ],
  });

  assert.equal(result.productBaseCostCny, "0.97");
  assert.equal(result.totalProductWeightKg, "0.450");
  assert.equal(result.serviceChargeCny, "0.06");
  assert.equal(result.totalCnyCost, "4.62");
  assert.equal(result.convertedCnyCostBdt, "14");
  assert.equal(result.internationalShippingBdt, "0.05");
  assert.equal(result.grandEstimatedTotalBdt, "14.05");
});

test("applies the service charge only to product base cost", () => {
  const result = calculateLogisticsEstimate({
    productId: "product-1",
    exchangeRate: "1",
    internationalShippingCategory: "Wallet",
    internationalShippingRateBdtPerKg: "750",
    lines: [
      { skuId: "sku-heavy", unitPriceCny: "100.00", quantity: 1, unitWeightKg: "10.000" },
    ],
  });

  assert.equal(result.chinaDomesticShippingCny, "40.00");
  assert.equal(result.chinaToGuangzhouCostCny, "40.00");
  assert.equal(result.serviceChargeCny, "6.00");
  assert.equal(result.totalCnyCost, "186.00");
});

test("does not multiply international BDT shipping by the CNY exchange rate", () => {
  const result = calculateLogisticsEstimate({
    productId: "product-1",
    exchangeRate: "100",
    internationalShippingCategory: "Mouse",
    internationalShippingRateBdtPerKg: "700",
    lines: [
      { skuId: "sku-zero-price", unitPriceCny: "0", quantity: 1, unitWeightKg: "2.000" },
    ],
  });

  assert.equal(result.convertedCnyCostBdt, "1600");
  assert.equal(result.internationalShippingBdt, "1400.00");
  assert.equal(result.grandEstimatedTotalBdt, "3000.00");
});

test("missing weight does not produce a fabricated estimate", () => {
  assert.throws(
    () =>
      calculateLogisticsEstimate({
        productId: "product-1",
        exchangeRate: "19.20",
        internationalShippingCategory: "Mouse",
        internationalShippingRateBdtPerKg: "700",
        lines: [
          {
            skuId: "sku-missing-weight",
            unitPriceCny: "100.00",
            quantity: 1,
          },
        ],
      }),
    /unitWeightKg must be a valid decimal/,
  );
});

test("keeps tariff data grouped for selector use", () => {
  assert.ok(listShippingTariffGroups().includes("Computer Parts And Accessories"));
  assert.equal(findShippingTariffByItem("Perfume")?.rateBdtPerKg, 1350);
  assert.equal(findShippingTariffByItem("Laptop")?.rateBdtPerKg, 2200);
  assert.equal(findShippingTariffByItem("Small Fan/Portable Fan (With Battery)")?.rateBdtPerKg, 950);
  assert.equal(findShippingTariffByItem("Regular Pen")?.rateBdtPerKg, 1000);
});
