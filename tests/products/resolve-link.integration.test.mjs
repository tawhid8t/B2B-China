import assert from "node:assert/strict";
import test from "node:test";
import { resolveProductFromProvider } from "../../services/product-provider-service.ts";
import { resolveAndPersistProduct } from "../../services/product-resolution-service.ts";

const actorId = "11111111-1111-4111-8111-111111111111";
const productId = "22222222-2222-4222-8222-222222222222";
const skuId = "33333333-3333-4333-8333-333333333333";

test("resolves RapidAPI product data, persists the snapshot, and returns contract fields", async () => {
  const providerPayload = {
    Result: {
      Title: "Cotton shirt",
      TitleCN: "棉衬衫",
      Pictures: [{ Url: "https://images.example/shirt.jpg" }],
      CategoryName: "apparel",
      DeliveryCost: { Price: 8 },
      Price: { MinPrice: 42, MaxPrice: 46 },
      ConfiguredItems: [{ Id: "123:456", Price: { OriginalPrice: 42 }, Quantity: 120, Configurators: [{ Pid: "Color", Vid: "Black" }, { Pid: "Size", Vid: "M" }] }]
    }
  };
  const externalRequests = [];
  const events = [];
  const repository = {
    async startAttempt(input) { events.push(["start", input]); return "attempt-1"; },
    async persistSnapshot({ actorId: persistedActorId, product }) {
      events.push(["persist", { actorId: persistedActorId, raw: product.raw }]);
      return {
        productId,
        provider: product.provider,
        providerItemId: product.providerItemId,
        originalUrl: product.originalUrl,
        title: product.title,
        titleCn: product.titleCn,
        images: product.images,
        category: product.category,
        domesticDeliveryCny: product.domesticDeliveryCny,
        priceMinCny: product.priceMinCny,
        priceMaxCny: product.priceMaxCny,
        skus: product.skus.map((sku) => ({ skuId, providerSkuId: sku.providerSkuId, label: sku.label, attributes: sku.attributes, priceCny: sku.priceCny, availableQuantity: sku.availableQuantity, imageUrl: sku.imageUrl }))
      };
    },
    async findFreshSnapshot() { return null; },
    async completeAttempt(input) { events.push(["complete", input]); }
  };
  const fetcher = async (url, init) => {
    externalRequests.push({ url, init });
    return new Response(JSON.stringify(providerPayload), { status: 200, headers: { "content-type": "application/json" } });
  };

  const data = await resolveAndPersistProduct(
    { actorId, url: "https://detail.1688.com/offer/123456789.html" },
    { repository, resolveProvider: (url) => resolveProductFromProvider(url, { fetcher, rapidApiKey: "test-secret", rapidApiHost: "otapi.example.rapidapi.com", nodeEnv: "test" }) }
  );

  assert.equal(externalRequests[0].url, "https://otapi.example.rapidapi.com/BatchGetItemFullInfo?language=en&itemId=abb-123456789");
  assert.deepEqual(externalRequests[0].init.headers, { "x-rapidapi-key": "test-secret", "x-rapidapi-host": "otapi.example.rapidapi.com" });
  assert.equal(externalRequests[0].init.headers.Authorization, undefined);
  assert.equal(data.productId, productId);
  assert.equal(data.skus[0].skuId, skuId);
  assert.equal(data.skus[0].providerSkuId, "123:456");
  assert.equal(data.resolutionMeta.source, "provider");
  assert.equal(data.resolutionMeta.cached, false);
  assert.equal(Number.isInteger(data.resolutionMeta.timings.providerMs), true);
  assert.equal(Number.isInteger(data.resolutionMeta.timings.persistenceMs), true);
  assert.equal(Number.isInteger(data.resolutionMeta.timings.totalMs), true);
  assert.deepEqual(data.skus[0].attributes, { Color: "Black", Size: "M" });
  assert.deepEqual(events[1][1].raw, providerPayload);
  assert.equal(events[2][1].status, "success");
  assert.deepEqual(events[2][1].rawPayload, providerPayload);
});

test("records failed RapidAPI responses with their raw payload", async () => {
  const events = [];
  const repository = {
    async startAttempt(input) { events.push(["start", input]); return "attempt-2"; },
    async persistSnapshot() { throw new Error("Persistence should not run."); },
    async findFreshSnapshot() { return null; },
    async completeAttempt(input) { events.push(["complete", input]); }
  };
  const providerPayload = { message: "upstream unavailable" };

  await assert.rejects(
    resolveAndPersistProduct(
      { actorId, url: "https://detail.tmall.com/item.htm?id=789" },
      {
        repository,
        resolveProvider: (url) => resolveProductFromProvider(url, {
          fetcher: async () => new Response(JSON.stringify(providerPayload), { status: 503, headers: { "content-type": "application/json" } }),
          rapidApiKey: "test-secret",
          rapidApiHost: "otapi.example.rapidapi.com",
          nodeEnv: "test"
        })
      }
    ),
    (error) => error?.kind === "lookup_failed"
  );

  assert.equal(events[0][1].provider, "taobao");
  assert.equal(events[1][1].status, "failed");
  assert.deepEqual(events[1][1].rawPayload, providerPayload);
});

test("uses a complete fresh persisted snapshot after a retryable provider failure", async () => {
  const events = [];
  const cachedProduct = {
    productId, provider: "alibaba1688", providerItemId: "123456789", originalUrl: "https://detail.1688.com/offer/123456789.html",
    title: "Cached organizer", images: ["https://images.example/cached.jpg"], category: "bags", domesticDeliveryCny: 6,
    priceMinCny: 18.8, priceMaxCny: 22.5,
    skus: [{ skuId, providerSkuId: "navy-m", label: "Navy / Medium", attributes: { Color: "Navy", Size: "Medium" }, priceCny: 20.2, availableQuantity: 18 }]
  };
  const repository = {
    async startAttempt() { return "attempt-cache"; },
    async persistSnapshot() { throw new Error("Persistence should not run."); },
    async findFreshSnapshot(input) { events.push(["cache", input]); return { product: cachedProduct, ageMs: 30_400 }; },
    async completeAttempt(input) { events.push(["complete", input]); }
  };
  const retryable = Object.assign(new Error("still preparing"), { kind: "lookup_failed", details: { retryable: true }, rawPayload: { ErrorCode: "NotAvailable" } });
  const result = await resolveAndPersistProduct({ actorId, url: cachedProduct.originalUrl }, { repository, resolveProvider: async () => { throw retryable; } });
  assert.equal(result.productId, productId);
  assert.equal(result.skus[0].skuId, skuId);
  assert.equal(result.resolutionMeta.source, "persisted_snapshot");
  assert.equal(result.resolutionMeta.cached, true);
  assert.equal(result.resolutionMeta.snapshotAgeSeconds, 30);
  assert.equal(Number.isInteger(result.resolutionMeta.timings.providerMs), true);
  assert.equal(Number.isInteger(result.resolutionMeta.timings.totalMs), true);
  assert.deepEqual(events[0][1], { provider: "alibaba1688", providerItemId: "123456789", maxAgeMs: 900000 });
  assert.equal(events[1][1].status, "success");
});

test("does not hide retryable provider failure when no valid fresh snapshot exists", async () => {
  const events = [];
  const repository = {
    async startAttempt() { return "attempt-no-cache"; },
    async persistSnapshot() { throw new Error("Persistence should not run."); },
    async findFreshSnapshot() { return null; },
    async completeAttempt(input) { events.push(input); }
  };
  const retryable = Object.assign(new Error("still preparing"), { kind: "lookup_failed", details: { retryable: true } });
  await assert.rejects(resolveAndPersistProduct({ actorId, url: "https://detail.1688.com/offer/123456789.html" }, { repository, resolveProvider: async () => { throw retryable; } }), (error) => error === retryable);
  assert.equal(events[0].status, "failed");
});

test("never enables development mock mode in production", async () => {
  await assert.rejects(
    resolveProductFromProvider("https://item.taobao.com/item.htm?id=456", { devMockMode: true, nodeEnv: "production" }),
    (error) => error?.kind === "manual_review_required"
  );
});
