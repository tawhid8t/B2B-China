import assert from "node:assert/strict";
import test from "node:test";

import {
  EstimateRequestError,
  createEstimate,
} from "../../services/estimate-service.ts";

const IDS = {
  client: "81000000-0000-0000-0000-000000000001",
  product: "83000000-0000-0000-0000-000000000001",
  sku: "84000000-0000-0000-0000-000000000001",
};

function createContext(overrides = {}) {
  const context = {
    clientId: IDS.client,
    productId: IDS.product,
    skuId: IDS.sku,
    unitPriceCny: "42.00",
    domesticDeliveryCny: "8.00",
    category: "apparel",
    defaultWeightKg: "0.350",
    exchangeRate: {
      id: "exchange-current",
      cnyToBdt: "16.2000",
      source: "admin",
      effectiveOn: "2026-08-26",
    },
    categoryShippingRate: {
      id: "shipping-apparel",
      bdtPerKg: "620.00",
    },
    profitRule: {
      id: "profit-current",
      name: "Current profit",
      category: null,
      percentage: "0.0800",
      fixedBdt: null,
    },
    chinaToGuangzhou: {
      id: "guangzhou-current",
      bdtPerKg: "35.00",
    },
    validity: {
      id: "validity-current",
      minutes: 1_440,
    },
  };

  return { ...context, ...overrides };
}

function createRepository(context) {
  const calls = { loads: [], persisted: [] };
  return {
    calls,
    repository: {
      async loadCalculationContext(input) {
        calls.loads.push(input);
        return context;
      },
      async persistEstimate(input) {
        calls.persisted.push(input);
        return {
          id: "estimate-created",
          status: "sent_to_client",
          validUntil: input.calculation.validUntil,
        };
      },
    },
  };
}

test("loads persisted product/configuration values and persists a complete estimate", async () => {
  const { repository, calls } = createRepository(createContext());
  const result = await createEstimate(
    repository,
    {
      clientId: IDS.client,
      productId: IDS.product,
      skuId: IDS.sku,
      quantity: 12,
      estimatedUnitWeightKg: "0.350",
      notes: "  Initial request  ",
    },
    { calculatedAt: "2026-08-26T10:00:00.000Z" },
  );

  assert.deepEqual(calls.loads, [{
    clientId: IDS.client,
    productId: IDS.product,
    skuId: IDS.sku,
  }]);
  assert.equal(calls.persisted.length, 1);
  assert.equal(calls.persisted[0].status, "sent_to_client");
  assert.equal(calls.persisted[0].notes, "Initial request");
  assert.equal(calls.persisted[0].calculation.breakdown.totalBdt, "11708.95");
  assert.equal(
    calls.persisted[0].calculation.inputSnapshot.exchangeRate.id,
    "exchange-current",
  );
  assert.equal(
    calls.persisted[0].calculation.inputSnapshot.chinaToGuangzhouCost.id,
    "guangzhou-current",
  );
  assert.equal(result.estimateId, "estimate-created");
  assert.equal(result.status, "sent_to_client");
  assert.equal(result.validUntil, "2026-08-27T10:00:00.000Z");
});

test("uses the persisted category default when request weight is omitted", async () => {
  const { repository, calls } = createRepository(createContext());

  await createEstimate(
    repository,
    {
      clientId: IDS.client,
      productId: IDS.product,
      skuId: IDS.sku,
      quantity: 2,
    },
    { calculatedAt: "2026-08-26T10:00:00.000Z" },
  );

  assert.equal(
    calls.persisted[0].calculation.inputSnapshot.estimatedUnitWeightKg,
    "0.350",
  );
});

test("requires manual review when neither request nor configuration supplies weight", async () => {
  const { repository, calls } = createRepository(
    createContext({ defaultWeightKg: null }),
  );

  await assert.rejects(
    () =>
      createEstimate(repository, {
        clientId: IDS.client,
        productId: IDS.product,
        skuId: IDS.sku,
        quantity: 2,
      }),
    (error) =>
      error instanceof EstimateRequestError &&
      error.code === "MANUAL_REVIEW_REQUIRED",
  );
  assert.equal(calls.persisted.length, 0);
});

test("new database rates affect only new estimates", async () => {
  const originalContext = createContext();
  const originalRepository = createRepository(originalContext);
  const historical = await createEstimate(
    originalRepository.repository,
    { productId: IDS.product, skuId: IDS.sku, clientId: IDS.client, quantity: 12 },
    { calculatedAt: "2026-08-26T10:00:00.000Z" },
  );

  const currentContext = createContext({
    exchangeRate: {
      ...originalContext.exchangeRate,
      id: "exchange-new",
      cnyToBdt: "18.0000",
      effectiveOn: "2026-08-27",
    },
  });
  const currentRepository = createRepository(currentContext);
  const current = await createEstimate(
    currentRepository.repository,
    { productId: IDS.product, skuId: IDS.sku, clientId: IDS.client, quantity: 12 },
    { calculatedAt: "2026-08-27T10:00:00.000Z" },
  );

  assert.equal(historical.breakdown.exchangeRateCnyToBdt, "16.2000");
  assert.equal(
    originalRepository.calls.persisted[0].calculation.inputSnapshot.exchangeRate.id,
    "exchange-current",
  );
  assert.equal(current.breakdown.exchangeRateCnyToBdt, "18.0000");
  assert.notEqual(current.breakdown.totalBdt, historical.breakdown.totalBdt);
});

test("rejects repository context that does not match the authenticated request", async () => {
  const { repository, calls } = createRepository(
    createContext({ clientId: "82000000-0000-0000-0000-000000000002" }),
  );

  await assert.rejects(
    () =>
      createEstimate(repository, {
        clientId: IDS.client,
        productId: IDS.product,
        skuId: IDS.sku,
        quantity: 1,
      }),
    (error) =>
      error instanceof EstimateRequestError && error.code === "NOT_FOUND",
  );
  assert.equal(calls.persisted.length, 0);
});
