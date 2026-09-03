import assert from "node:assert/strict";
import test from "node:test";
import { createPreviewRateLimiter, resolvePublicProductPreview } from "../../services/public-product-preview-service.ts";

const product = {
  provider: "alibaba1688",
  source: "alibaba1688",
  providerItemId: "123456789",
  originalUrl: "https://detail.1688.com/offer/123456789.html",
  title: "Cotton shirt",
  titleCn: "棉衬衫",
  images: ["https://images.example/shirt.jpg"],
  category: "apparel",
  domesticDeliveryCny: 8,
  priceMinCny: 42,
  priceMaxCny: 46,
  skus: [{ id: "black-m", label: "Black / M", attributes: { color: "Black", size: "M" }, priceCny: 42 }],
  raw: { secretProviderField: "must-not-leak" }
};

test("public preview removes raw payloads and caches normalized results", async () => {
  const cache = new Map();
  let calls = 0;
  const resolveProvider = async () => { calls += 1; return product; };
  const first = await resolvePublicProductPreview(product.originalUrl, { cache, resolveProvider, now: () => 1000 });
  const second = await resolvePublicProductPreview(product.originalUrl, { cache, resolveProvider, now: () => 1001 });

  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(calls, 1);
  assert.equal("raw" in first.product, false);
  assert.equal("source" in first.product, false);
  assert.equal(first.product.title, "Cotton shirt");
  assert.equal(first.product.skus[0].label, "Black / M");
});

test("preview rate limiter returns a retry window after the configured limit", () => {
  const limiter = createPreviewRateLimiter({ limit: 2, windowMs: 1000 });
  assert.equal(limiter.check("visitor", 0).allowed, true);
  assert.equal(limiter.check("visitor", 100).allowed, true);
  const blocked = limiter.check("visitor", 200);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 1);
  assert.equal(limiter.check("visitor", 1000).allowed, true);
});
