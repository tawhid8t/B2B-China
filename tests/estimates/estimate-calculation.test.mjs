import assert from "node:assert/strict";
import test from "node:test";

import {
  EstimateCalculationError,
  EstimateExpiredError,
  assertEstimateNotExpired,
  calculateEstimate,
  isEstimateExpired,
} from "../../services/estimate-calculation-service.ts";

const CALCULATED_AT = "2026-08-26T10:00:00.000Z";

function createInput(overrides = {}) {
  const input = {
    productId: "product-1",
    skuId: "sku-1",
    category: "apparel",
    unitPriceCny: "42.00",
    quantity: 12,
    domesticDeliveryCny: "8.00",
    estimatedUnitWeightKg: "0.350",
    configuration: {
      exchangeRate: {
        id: "exchange-2026-08-26",
        cnyToBdt: "16.2000",
        source: "admin_setting",
        effectiveOn: "2026-08-26",
      },
      categoryShippingRate: {
        id: "shipping-apparel-v1",
        category: "apparel",
        bdtPerKg: "620.00",
      },
      chinaToGuangzhouCost: {
        id: "guangzhou-v1",
        mode: "per_kg",
        bdtPerKg: "35.00",
      },
      profitRule: {
        id: "profit-default-v1",
        name: "Default percentage",
        category: null,
        percentage: "0.0800",
        fixedBdt: null,
      },
      validity: {
        id: "estimate-validity-v1",
        minutes: 1_440,
      },
    },
  };

  return {
    ...input,
    ...overrides,
    configuration: {
      ...input.configuration,
      ...(overrides.configuration ?? {}),
    },
  };
}

test("calculates the documented percentage-profit breakdown", () => {
  const result = calculateEstimate(createInput(), { calculatedAt: CALCULATED_AT });

  assert.deepEqual(result.breakdown, {
    unitPriceCny: "42.00",
    quantity: 12,
    productSubtotalCny: "504.00",
    domesticDeliveryCny: "8.00",
    productAndDomesticCny: "512.00",
    exchangeRateCnyToBdt: "16.2000",
    productSubtotalBdt: "8294.40",
    estimatedUnitWeightKg: "0.350",
    estimatedTotalWeightKg: "4.200",
    categoryShippingRateBdtPerKg: "620.00",
    categoryShippingBdt: "2604.00",
    chinaToGuangzhouMode: "per_kg",
    chinaToGuangzhouRateBdtPerKg: "35.00",
    chinaToGuangzhouBdt: "147.00",
    profitPercentage: "0.0800",
    profitFixedBdt: null,
    percentageProfitBdt: "663.55",
    profitBdt: "663.55",
    totalBdt: "11708.95",
  });
});

test("supports a fixed-only profit rule and fixed Guangzhou cost", () => {
  const result = calculateEstimate(
    createInput({
      unitPriceCny: "10.00",
      quantity: 3,
      domesticDeliveryCny: "5.00",
      estimatedUnitWeightKg: "0.200",
      configuration: {
        exchangeRate: {
          id: "exchange-v2",
          cnyToBdt: "10.0000",
          source: "test",
          effectiveOn: "2026-08-26",
        },
        categoryShippingRate: {
          id: "shipping-v2",
          category: "apparel",
          bdtPerKg: "100.00",
        },
        chinaToGuangzhouCost: {
          id: "guangzhou-fixed-v1",
          mode: "fixed",
          fixedBdt: "40.00",
        },
        profitRule: {
          id: "profit-fixed-v1",
          name: "Fixed",
          category: "apparel",
          percentage: null,
          fixedBdt: "25.00",
        },
      },
    }),
    { calculatedAt: CALCULATED_AT },
  );

  assert.equal(result.breakdown.productSubtotalBdt, "350.00");
  assert.equal(result.breakdown.categoryShippingBdt, "60.00");
  assert.equal(result.breakdown.chinaToGuangzhouRateBdtPerKg, null);
  assert.equal(result.breakdown.chinaToGuangzhouBdt, "40.00");
  assert.equal(result.breakdown.percentageProfitBdt, "0.00");
  assert.equal(result.breakdown.profitBdt, "25.00");
  assert.equal(result.breakdown.totalBdt, "475.00");
});

test("combines percentage and fixed profit components", () => {
  const result = calculateEstimate(
    createInput({
      unitPriceCny: "10.00",
      quantity: 3,
      domesticDeliveryCny: "5.00",
      estimatedUnitWeightKg: "0.200",
      configuration: {
        exchangeRate: {
          id: "exchange-v2",
          cnyToBdt: "10.0000",
          source: "test",
          effectiveOn: "2026-08-26",
        },
        categoryShippingRate: {
          id: "shipping-v2",
          category: "apparel",
          bdtPerKg: "100.00",
        },
        chinaToGuangzhouCost: {
          id: "guangzhou-fixed-v1",
          mode: "fixed",
          fixedBdt: "40.00",
        },
        profitRule: {
          id: "profit-combined-v1",
          name: "Combined",
          category: null,
          percentage: "0.1000",
          fixedBdt: "25.00",
        },
      },
    }),
    { calculatedAt: CALCULATED_AT },
  );

  assert.equal(result.breakdown.percentageProfitBdt, "35.00");
  assert.equal(result.breakdown.profitBdt, "60.00");
  assert.equal(result.breakdown.totalBdt, "510.00");
});

test("uses fixed-point arithmetic without binary floating-point artifacts", () => {
  const result = calculateEstimate(
    createInput({
      unitPriceCny: 0.1,
      quantity: 3,
      domesticDeliveryCny: 0.2,
      estimatedUnitWeightKg: 0.1,
      configuration: {
        exchangeRate: {
          id: "exchange-decimal",
          cnyToBdt: 3,
          source: "test",
          effectiveOn: "2026-08-26",
        },
        categoryShippingRate: {
          id: "shipping-decimal",
          category: "apparel",
          bdtPerKg: 0.1,
        },
        chinaToGuangzhouCost: {
          id: "guangzhou-decimal",
          mode: "per_kg",
          bdtPerKg: 0.1,
        },
        profitRule: {
          id: "profit-decimal",
          name: "Decimal",
          category: null,
          percentage: 0.1,
          fixedBdt: null,
        },
      },
    }),
    { calculatedAt: CALCULATED_AT },
  );

  assert.equal(result.breakdown.productAndDomesticCny, "0.50");
  assert.equal(result.breakdown.productSubtotalBdt, "1.50");
  assert.equal(result.breakdown.categoryShippingBdt, "0.03");
  assert.equal(result.breakdown.chinaToGuangzhouBdt, "0.03");
  assert.equal(result.breakdown.profitBdt, "0.15");
  assert.equal(result.breakdown.totalBdt, "1.71");
});

test("rounds monetary half values away from zero", () => {
  const result = calculateEstimate(
    createInput({
      unitPriceCny: "1.005",
      quantity: 1,
      domesticDeliveryCny: 0,
      estimatedUnitWeightKg: "0.001",
      configuration: {
        exchangeRate: {
          id: "exchange-rounding",
          cnyToBdt: 1,
          source: "test",
          effectiveOn: "2026-08-26",
        },
        categoryShippingRate: {
          id: "shipping-rounding",
          category: "apparel",
          bdtPerKg: 1,
        },
        chinaToGuangzhouCost: {
          id: "guangzhou-rounding",
          mode: "fixed",
          fixedBdt: 0,
        },
        profitRule: {
          id: "profit-rounding",
          name: "Zero fixed",
          category: null,
          percentage: null,
          fixedBdt: 0,
        },
      },
    }),
    { calculatedAt: CALCULATED_AT },
  );

  assert.equal(result.breakdown.productSubtotalCny, "1.01");
  assert.equal(result.breakdown.totalBdt, "1.01");
});

test("snapshots every persisted configuration reference and normalized value", () => {
  const input = createInput();
  const result = calculateEstimate(input, { calculatedAt: CALCULATED_AT });

  assert.deepEqual(result.inputSnapshot.exchangeRate, {
    id: "exchange-2026-08-26",
    cnyToBdt: "16.2000",
    source: "admin_setting",
    effectiveOn: "2026-08-26",
  });
  assert.deepEqual(result.inputSnapshot.validity, {
    id: "estimate-validity-v1",
    minutes: 1_440,
  });
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.inputSnapshot.profitRule), true);
});

test("historical result remains unchanged when caller configuration changes", () => {
  const input = createInput();
  const historical = calculateEstimate(input, { calculatedAt: CALCULATED_AT });

  input.configuration.exchangeRate.cnyToBdt = "20.0000";
  input.configuration.profitRule.percentage = "0.1200";
  const current = calculateEstimate(input, { calculatedAt: CALCULATED_AT });

  assert.equal(historical.breakdown.exchangeRateCnyToBdt, "16.2000");
  assert.equal(historical.breakdown.totalBdt, "11708.95");
  assert.equal(current.breakdown.exchangeRateCnyToBdt, "20.0000");
  assert.notEqual(current.breakdown.totalBdt, historical.breakdown.totalBdt);
});

test("stores deterministic calculation and validity timestamps", () => {
  const result = calculateEstimate(createInput(), { calculatedAt: CALCULATED_AT });

  assert.equal(result.calculatedAt, "2026-08-26T10:00:00.000Z");
  assert.equal(result.validUntil, "2026-08-27T10:00:00.000Z");
});

test("treats the exact validity boundary as expired", () => {
  const validUntil = "2026-08-27T10:00:00.000Z";

  assert.equal(isEstimateExpired(validUntil, "2026-08-27T09:59:59.999Z"), false);
  assert.equal(isEstimateExpired(validUntil, validUntil), true);
  assert.throws(
    () => assertEstimateNotExpired(validUntil, validUntil),
    (error) =>
      error instanceof EstimateExpiredError &&
      error.code === "ESTIMATE_EXPIRED" &&
      error.validUntil === validUntil,
  );
});

test("acceptance guard allows an unexpired estimate", () => {
  assert.doesNotThrow(() =>
    assertEstimateNotExpired(
      "2026-08-27T10:00:00.000Z",
      "2026-08-27T09:59:59.999Z",
    ),
  );
});

test("rejects invalid quantities and negative values", () => {
  for (const quantity of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(
      () => calculateEstimate(createInput({ quantity }), { calculatedAt: CALCULATED_AT }),
      EstimateCalculationError,
    );
  }

  assert.throws(
    () =>
      calculateEstimate(createInput({ unitPriceCny: "-0.01" }), {
        calculatedAt: CALCULATED_AT,
      }),
    /unitPriceCny must be non-negative/,
  );
});

test("rejects missing profit components", () => {
  assert.throws(
    () =>
      calculateEstimate(
        createInput({
          configuration: {
            profitRule: {
              id: "invalid-profit",
              name: "Invalid",
              category: null,
              percentage: null,
              fixedBdt: null,
            },
          },
        }),
        { calculatedAt: CALCULATED_AT },
      ),
    /must include percentage, fixedBdt, or both/,
  );
});

test("rejects category-specific configuration for another category", () => {
  assert.throws(
    () =>
      calculateEstimate(
        createInput({
          configuration: {
            categoryShippingRate: {
              id: "shipping-electronics",
              category: "electronics",
              bdtPerKg: "500.00",
            },
          },
        }),
        { calculatedAt: CALCULATED_AT },
      ),
    /categoryShippingRate.category must match/,
  );

  assert.throws(
    () =>
      calculateEstimate(
        createInput({
          configuration: {
            profitRule: {
              id: "profit-electronics",
              name: "Electronics",
              category: "electronics",
              percentage: "0.0500",
              fixedBdt: null,
            },
          },
        }),
        { calculatedAt: CALCULATED_AT },
      ),
    /profitRule.category must be null or match/,
  );
});

test("rejects invalid persisted validity and timestamps", () => {
  assert.throws(
    () =>
      calculateEstimate(
        createInput({ configuration: { validity: { id: "validity", minutes: 0 } } }),
        { calculatedAt: CALCULATED_AT },
      ),
    /validity.minutes must be a positive safe integer/,
  );

  assert.throws(
    () => calculateEstimate(createInput(), { calculatedAt: "not-a-date" }),
    /calculatedAt must be a valid timestamp/,
  );
  assert.throws(
    () => isEstimateExpired("not-a-date", CALCULATED_AT),
    /validUntil must be a valid timestamp/,
  );
});

test("rejects malformed persisted exchange-rate metadata", () => {
  assert.throws(
    () =>
      calculateEstimate(
        createInput({
          configuration: {
            exchangeRate: {
              id: "exchange-invalid-date",
              cnyToBdt: "16.2",
              source: "test",
              effectiveOn: "26/08/2026",
            },
          },
        }),
        { calculatedAt: CALCULATED_AT },
      ),
    /effectiveOn must be an ISO date/,
  );
});
