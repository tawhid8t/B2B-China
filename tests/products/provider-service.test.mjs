import assert from "node:assert/strict";
import test from "node:test";
import { ProductProviderError, identifyProductSource, normalize1688ItemId, normalizeOtapiProduct, resolveProductFromProvider } from "../../services/product-provider-service.ts";

test("recognizes 1688, Taobao, and Tmall product links", () => {
  assert.deepEqual(identifyProductSource("https://detail.1688.com/offer/123456789.html"), {
    source: "alibaba1688", provider: "alibaba1688", providerItemId: "123456789", originalUrl: "https://detail.1688.com/offer/123456789.html"
  });
  assert.equal(identifyProductSource("https://item.taobao.com/item.htm?id=456").source, "taobao");
  const tmall = identifyProductSource("https://detail.tmall.com/item.htm?id=789");
  assert.equal(tmall.source, "tmall");
  assert.equal(tmall.provider, "taobao");
});

test("rejects unsupported and incomplete provider links with actionable errors", () => {
  assert.throws(() => identifyProductSource("https://example.com/item?id=1"), (error) => error instanceof ProductProviderError && error.kind === "unsupported_source");
  assert.throws(() => identifyProductSource("https://detail.1688.com/offer/"), (error) => error instanceof ProductProviderError && error.kind === "manual_review_required");
});

test("normalizes 1688 URLs and offer IDs for OTAPI without double prefixing", () => {
  assert.equal(normalize1688ItemId("https://detail.1688.com/offer/924121121439.html"), "abb-924121121439");
  assert.equal(normalize1688ItemId("https://detail.1688.com/offer/924121121439.html?offerId=924121121439"), "abb-924121121439");
  assert.equal(normalize1688ItemId("https://detail.1688.com/offer/924121121439.html?spm=a260k.xxx&offerId=924121121439&hotSale=true"), "abb-924121121439");
  assert.equal(normalize1688ItemId("924121121439"), "abb-924121121439");
  assert.equal(normalize1688ItemId("ABB-924121121439"), "abb-924121121439");
  for (const invalidInput of ["hello", "https://google.com/12345", "https://detail.1688.com/"]) {
    assert.throws(() => normalize1688ItemId(invalidInput), (error) => error instanceof ProductProviderError && error.kind === "invalid_link" && error.message === "Invalid 1688 product URL or offer ID.");
  }
});

test("normalizes OTAPI product payloads and preserves the raw payload", () => {
  const identity = identifyProductSource("https://item.taobao.com/item.htm?id=456");
  const payload = {
    Result: {
      Title: "Cotton shirt",
      TitleCN: "棉衬衫",
      Pictures: [{ Url: "https://images.example/shirt.jpg" }],
      CategoryName: "apparel",
      DeliveryCost: { Price: "8" },
      Price: { MinPrice: "42", MaxPrice: "46" },
      Configurations: [{ Id: "123:456", DisplayName: "Black / M", Attributes: { color: "Black", size: "M" }, Price: { OriginalPrice: "42" }, Quantity: "120", ImageUrl: "https://images.example/black.jpg" }]
    }
  };
  const product = normalizeOtapiProduct(identity, payload);

  assert.equal(product.title, "Cotton shirt");
  assert.equal(product.titleCn, "棉衬衫");
  assert.deepEqual(product.images, ["https://images.example/shirt.jpg"]);
  assert.equal(product.domesticDeliveryCny, 8);
  assert.equal(product.priceMinCny, 42);
  assert.equal(product.priceMaxCny, 46);
  assert.deepEqual(product.skus[0], { id: "123:456", providerSkuId: "123:456", label: "Black / M", attributes: { color: "Black", size: "M" }, priceCny: 42, availableQuantity: 120, imageUrl: "https://images.example/black.jpg" });
  assert.equal(product.raw, payload);
});

test("normalizes OTAPI ConfiguredItems and Configurators into selectable SKU attributes", () => {
  const identity = identifyProductSource("https://detail.1688.com/offer/924121121439.html");
  const payload = {
    Result: {
      Item: {
        Title: "Sandals",
        OriginalTitle: "\u51c9\u978b",
        MainPictureUrl: "https://images.example/sandals.jpg",
        Price: { OriginalPrice: 14.5 },
        ConfiguredItems: [
          { Id: "red-36", Quantity: 12, Price: { OriginalPrice: 14.5 }, Configurators: [{ Pid: "Color", Vid: "Red" }, { Pid: "Size", Vid: "36" }] },
          { Id: "blue-37", Quantity: 0, Price: { OriginalPrice: 15 }, Configurators: [{ Pid: "Color", Vid: "Blue" }, { Pid: "Size", Vid: "37" }] }
        ]
      }
    }
  };
  const product = normalizeOtapiProduct(identity, payload);

  assert.equal(product.titleCn, "\u51c9\u978b");
  assert.deepEqual(product.skus, [
    { id: "red-36", providerSkuId: "red-36", label: "Red / 36", attributes: { Color: "Red", Size: "36" }, priceCny: 14.5, availableQuantity: 12, imageUrl: undefined },
    { id: "blue-37", providerSkuId: "blue-37", label: "Blue / 37", attributes: { Color: "Blue", Size: "37" }, priceCny: 15, availableQuantity: 0, imageUrl: undefined }
  ]);
});

test("does not fabricate a Default SKU when configurable OTAPI data is malformed", async () => {
  const identity = identifyProductSource("https://detail.1688.com/offer/924121121439.html");
  const product = normalizeOtapiProduct(identity, { Result: { Item: { Title: "Sandals", MainPictureUrl: "https://images.example/sandals.jpg", ConfiguredItems: [{ Quantity: 1 }] } } });
  assert.deepEqual(product.skus, []);
});

test("uses a Default SKU only when the source returns no configuration collection", () => {
  const identity = identifyProductSource("https://detail.1688.com/offer/924121121439.html");
  const product = normalizeOtapiProduct(identity, { Result: { Item: { Title: "Single item", MainPictureUrl: "https://images.example/item.jpg", Price: { OriginalPrice: 8 } } } });
  assert.deepEqual(product.skus, [{ id: "default", providerSkuId: "default", label: "Default", attributes: {}, priceCny: 8 }]);
});

test("retries temporary OTAPI ItemIsNotComplete responses and then resolves", async () => {
  let calls = 0;
  const temporary = { ErrorCode: "NotAvailable", SubErrorCode: { Value: "ItemIsNotComplete" }, ErrorDescription: "Item is still loading" };
  const resolved = { Result: { Item: { Title: "Ready item", Pictures: [{ Url: "https://images.example/ready.jpg" }], Price: { OriginalPrice: 9 } } } };
  const product = await resolveProductFromProvider("https://detail.1688.com/offer/123456789.html", {
    rapidApiKey: "test-secret", rapidApiHost: "otapi.example.rapidapi.com", nodeEnv: "test", retryDelaysMs: [0, 0],
    fetcher: async () => new Response(JSON.stringify(++calls < 3 ? temporary : resolved), { status: 200 })
  });
  assert.equal(calls, 3);
  assert.equal(product.title, "Ready item");
});

test("classifies exhausted ItemIsNotComplete responses as retryable lookup failures", async () => {
  let calls = 0;
  const temporary = { ErrorCode: "NotAvailable", SubErrorCode: { Value: "ItemIsNotComplete" }, ErrorDescription: "Item is still loading" };
  await assert.rejects(resolveProductFromProvider("https://detail.1688.com/offer/123456789.html", {
    rapidApiKey: "test-secret", rapidApiHost: "otapi.example.rapidapi.com", nodeEnv: "test", retryDelaysMs: [0, 0],
    fetcher: async () => { calls += 1; return new Response(JSON.stringify(temporary), { status: 200 }); }
  }), (error) => error instanceof ProductProviderError && error.kind === "lookup_failed" && error.details.retryable === true && error.details.attempts === 3 && error.details.providerSubcode === "ItemIsNotComplete");
  assert.equal(calls, 3);
});

test("recognizes non-success OTAPI envelopes returned with HTTP 200", async () => {
  await assert.rejects(resolveProductFromProvider("https://item.taobao.com/item.htm?id=456", {
    rapidApiKey: "test-secret", rapidApiHost: "otapi.example.rapidapi.com", nodeEnv: "test",
    fetcher: async () => new Response(JSON.stringify({ ErrorCode: "InvalidRequest", ErrorDescription: "Bad item" }), { status: 200 })
  }), (error) => error instanceof ProductProviderError && error.kind === "lookup_failed" && error.details.providerCode === "InvalidRequest");
});

test("accepts OTAPI HTTP-200 payloads whose success metadata is ErrorCode Ok", async () => {
  const product = await resolveProductFromProvider("https://detail.1688.com/offer/816432828739.html", {
    rapidApiKey: "test-secret", rapidApiHost: "otapi.example.rapidapi.com", nodeEnv: "test",
    fetcher: async () => new Response(JSON.stringify({
      ErrorCode: "Ok",
      Result: { Item: {
        Title: "Successful provider item",
        Pictures: [{ Url: "https://images.example/item.jpg" }],
        Attributes: [{ Pid: "1", Vid: "10", PropertyName: "Color", Value: "Black" }],
        ConfiguredItems: [{ Id: "black", Price: { OriginalPrice: 12 }, Quantity: 25, Configurators: [{ Pid: "1", Vid: "10" }] }]
      } }
    }), { status: 200 })
  });
  assert.equal(product.title, "Successful provider item");
  assert.equal(product.skus[0].attributes.Color, "Black");
});

test("resolves configurator IDs through Attributes and normalizes OTAPI price and delivery structures", () => {
  const identity = identifyProductSource("https://detail.1688.com/offer/123456789.html");
  const product = normalizeOtapiProduct(identity, { Result: { Item: {
    Title: "Organizer", Pictures: [{ Url: "https://images.example/item.jpg" }], Price: { DeliveryPrice: "7.5", OriginalPrice: "18.8" },
    Attributes: [
      { Pid: "1", Vid: "10", PropertyName: "Color", Value: "Navy", OriginalValue: "藏青色", ImageUrl: "https://images.example/navy.jpg" },
      { Pid: "2", Vid: "20", PropertyName: "Size", Value: "Large", OriginalValue: "大号" }
    ],
    ConfiguredItems: [{ Id: "sku-1", Price: { OriginalPrice: "22.5" }, Quantity: "0", Configurators: [{ Pid: "1", Vid: "10" }, { Pid: "2", Vid: "20" }] }]
  } } });
  assert.deepEqual(product.skus[0].attributes, { Color: "Navy", Size: "Large" });
  assert.equal(product.skus[0].imageUrl, "https://images.example/navy.jpg");
  assert.equal(product.skus[0].availableQuantity, 0);
  assert.equal(product.domesticDeliveryCny, 7.5);
  assert.equal(product.priceMinCny, 22.5);
  assert.equal(product.priceMaxCny, 22.5);
});

test("normalizes up to 500 configured SKUs without the former 24-item truncation", () => {
  const identity = identifyProductSource("https://detail.1688.com/offer/123456789.html");
  const configuredItems = Array.from({ length: 520 }, (_, index) => ({ Id: `sku-${index}`, Price: { OriginalPrice: 10 + index }, Quantity: index }));
  const product = normalizeOtapiProduct(identity, { Result: { Item: { Title: "Large matrix", Pictures: [{ Url: "https://images.example/item.jpg" }], ConfiguredItems: configuredItems } } });
  assert.equal(product.skus.length, 500);
  assert.equal(product.skus.at(-1).providerSkuId, "sku-499");
});

test("development-only fixture contains colors, sizes, images, stock, and an unavailable combination", async () => {
  const product = await resolveProductFromProvider("https://detail.1688.com/offer/123456789.html", { devMockMode: true, nodeEnv: "development" });
  assert.equal(product.skus.length, 6);
  assert.deepEqual(new Set(product.skus.map((sku) => sku.attributes.Color)), new Set(["Navy", "Ivory"]));
  assert.deepEqual(new Set(product.skus.map((sku) => sku.attributes.Size)), new Set(["Small", "Medium", "Large"]));
  assert.ok(product.skus.some((sku) => sku.availableQuantity === 0));
  assert.ok(product.skus.some((sku) => sku.imageUrl));
});
