import type { ProductSource, Provider, ResolvedProduct } from "../lib/domain/types";

export type ProductLinkIdentity = {
  source: ProductSource;
  provider: Provider;
  providerItemId: string;
  originalUrl: string;
};

export type ProductProviderErrorKind = "invalid_link" | "unsupported_source" | "lookup_failed" | "manual_review_required";

export class ProductProviderError extends Error {
  readonly kind: ProductProviderErrorKind;
  readonly details: Record<string, unknown>;
  readonly rawPayload?: unknown;

  constructor(kind: ProductProviderErrorKind, message: string, details: Record<string, unknown> = {}, rawPayload?: unknown) {
    super(message);
    this.name = "ProductProviderError";
    this.kind = kind;
    this.details = details;
    this.rawPayload = rawPayload;
  }
}

export function identifyProductSource(url: string): ProductLinkIdentity {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ProductProviderError("invalid_link", "A valid product URL is required.");
  }

  const host = parsed.hostname.toLowerCase();
  const source = hostMatches(host, "1688.com") ? "alibaba1688" : hostMatches(host, "taobao.com") ? "taobao" : hostMatches(host, "tmall.com") ? "tmall" : undefined;
  if (!source) {
    throw new ProductProviderError("unsupported_source", "Only 1688, Taobao, and Tmall product links are supported.", { host });
  }

  const providerItemId = source === "alibaba1688" ? extract1688OfferId(parsed) : extractProviderItemId(parsed);
  if (!providerItemId) {
    throw new ProductProviderError("manual_review_required", "The product link could not be identified automatically. Submit it for manual review.", { source });
  }

  return {
    source,
    provider: source === "alibaba1688" ? "alibaba1688" : "taobao",
    providerItemId,
    originalUrl: parsed.toString()
  };
}

export type ProductProviderOptions = {
  fetcher?: typeof fetch;
  rapidApiKey?: string;
  rapidApiHost?: string;
  devMockMode?: boolean;
  nodeEnv?: string;
  maxAttempts?: number;
  retryDelaysMs?: number[];
  totalBudgetMs?: number;
};

const PROVIDER_LOOKUP_TOTAL_BUDGET_MS = 20_000;
const PROVIDER_LOOKUP_MAX_ATTEMPTS = 3;
const PROVIDER_RETRY_DELAYS_MS = [800, 1_600];
const MAX_NORMALIZED_SKUS = 500;

export async function resolveProductFromProvider(url: string, options: ProductProviderOptions = {}): Promise<ResolvedProduct> {
  const identity = identifyProductSource(url);
  const nodeEnv = options.nodeEnv ?? process.env.NODE_ENV;
  const devMockMode = options.devMockMode ?? process.env.OTAPI_DEV_MOCK_MODE === "true";
  if (devMockMode && nodeEnv !== "production") return normalizeOtapiProduct(identity, developmentMockPayload(identity));

  const otapiItemId = identity.source === "alibaba1688" ? normalize1688ItemId(identity.providerItemId) : identity.providerItemId;
  logDevelopmentLookup(nodeEnv, identity, otapiItemId);

  const apiKey = options.rapidApiKey ?? process.env.RAPIDAPI_KEY?.trim();
  const apiHost = normalizeRapidApiHost(options.rapidApiHost ?? process.env.RAPIDAPI_HOST?.trim());
  if (!apiKey || !apiHost) {
    throw new ProductProviderError("manual_review_required", "Automatic product lookup is unavailable. Submit this product for manual review.", { source: identity.source });
  }

  const fetcher = options.fetcher ?? fetch;
  const maxAttempts = Math.min(Math.max(options.maxAttempts ?? PROVIDER_LOOKUP_MAX_ATTEMPTS, 1), PROVIDER_LOOKUP_MAX_ATTEMPTS);
  const retryDelaysMs = options.retryDelaysMs ?? PROVIDER_RETRY_DELAYS_MS;
  const totalBudgetMs = Math.min(Math.max(options.totalBudgetMs ?? PROVIDER_LOOKUP_TOTAL_BUDGET_MS, 1), PROVIDER_LOOKUP_TOTAL_BUDGET_MS);
  const deadline = Date.now() + totalBudgetMs;
  let payload: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw retryExhaustedError(identity, attempt - 1, payload, "budget_exhausted");
    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), remainingMs);
    let response: Response;
    try {
      response = await fetcher(`https://${apiHost}/BatchGetItemFullInfo?language=en&itemId=${encodeURIComponent(otapiItemId)}`, {
        headers: { "x-rapidapi-key": apiKey, "x-rapidapi-host": apiHost },
        cache: "no-store",
        signal: abortController.signal
      });
    } catch {
      clearTimeout(timeout);
      throw new ProductProviderError("lookup_failed", "The product provider could not be reached. Try again shortly.", {
        source: identity.source, retryable: true, attempts: attempt, maxAttempts, retryAfterSeconds: 5
      });
    }
    clearTimeout(timeout);

    if (!response.ok) {
      const rawPayload = await readProviderErrorPayload(response);
      throw new ProductProviderError("lookup_failed", "The product provider could not resolve this product. Try again shortly.", {
        source: identity.source, status: response.status, retryable: response.status >= 500 || response.status === 429, attempts: attempt, maxAttempts, retryAfterSeconds: 5
      }, rawPayload);
    }

    try {
      payload = await response.json();
    } catch {
      throw new ProductProviderError("lookup_failed", "The product provider returned an unreadable response. Try again shortly.", {
        source: identity.source, retryable: true, attempts: attempt, maxAttempts, retryAfterSeconds: 5
      });
    }

    const providerFailure = readProviderFailure(payload);
    if (!providerFailure) break;
    if (!providerFailure.itemIsNotComplete) {
      throw new ProductProviderError("lookup_failed", providerFailure.message ?? "The product provider could not resolve this product. Try again shortly.", {
        source: identity.source, retryable: providerFailure.retryable, providerCode: providerFailure.code, providerSubcode: providerFailure.subcode,
        attempts: attempt, maxAttempts, retryAfterSeconds: providerFailure.retryable ? 5 : undefined
      }, payload);
    }
    if (attempt === maxAttempts) throw retryExhaustedError(identity, attempt, payload, "item_incomplete");
    const delayMs = retryDelaysMs[attempt - 1] ?? 0;
    if (delayMs > 0) {
      if (Date.now() + delayMs >= deadline) throw retryExhaustedError(identity, attempt, payload, "budget_exhausted");
      await delay(delayMs);
    }
  }

  const product = normalizeOtapiProduct(identity, payload);
  if (product.title === "Imported product" || product.images.length === 0 || product.skus.length === 0) {
    throw new ProductProviderError("manual_review_required", "The supplier returned genuinely incomplete product data. This product needs manual review.", { source: identity.source, retryable: false }, payload);
  }
  return product;
}

export function normalizeOtapiProduct(identity: ProductLinkIdentity, payload: unknown): ResolvedProduct {
  const root = asRecord(payload);
  const providerResult = asRecord(root.Result ?? root.result ?? payload);
  const items = asRecord(providerResult.Items);
  const nestedItems = asRecord(items.Items);
  const content = nestedItems.Content ?? items.Content;
  const firstContent = Array.isArray(content) ? content[0] : undefined;
  const result = asRecord(providerResult.Item ?? providerResult.item ?? firstContent ?? providerResult);
  const productPrice = asRecord(result.Price);
  const images = normalizeImages(result);
  const skus = normalizeSkus(result);
  const title = firstString(result.Title, result.title, result.Name, result.name, result.OriginalTitle) ?? "Imported product";

  return {
    provider: identity.provider,
    source: identity.source,
    providerItemId: identity.providerItemId,
    originalUrl: identity.originalUrl,
    title,
    titleCn: firstString(result.TitleCn, result.TitleCN, result.title_cn, result.titleCn, result.OriginalTitle, result.original_title),
    images,
    category: firstString(result.CategoryName, result.category_name, result.category, result.Category) ?? "default",
    domesticDeliveryCny: normalizeDeliveryCost(result, productPrice),
    priceMinCny: normalizePriceRange(result, productPrice, skus).min,
    priceMaxCny: normalizePriceRange(result, productPrice, skus).max,
    skus,
    raw: payload
  };
}

function normalizeRapidApiHost(value: string | undefined) {
  if (!value || !/^[a-z0-9.-]+$/i.test(value) || value.startsWith(".") || value.endsWith(".")) return undefined;
  return value.toLowerCase();
}

async function readProviderErrorPayload(response: Response) {
  try {
    const body = await response.text();
    try {
      return JSON.parse(body);
    } catch {
      return body ? { message: body } : undefined;
    }
  } catch {
    return undefined;
  }
}

function developmentMockPayload(identity: ProductLinkIdentity) {
  return {
    Result: {
      Item: {
        Title: `${identity.source} development travel organizer`,
        OriginalTitle: "多功能旅行收纳包",
        Pictures: [{ Url: "/placeholder-product.svg?view=front" }, { Url: "/placeholder-product.svg?view=detail" }],
        CategoryName: "bags",
        Price: { OriginalPrice: 18.8, DeliveryPrice: 6, OneItemDeliveryPrice: 6 },
        DeliveryCosts: [{ Price: 6 }],
        Attributes: [
          { Pid: "1627207", Vid: "28341", PropertyName: "Color", Value: "Navy", OriginalValue: "藏青色", ImageUrl: "/placeholder-product.svg", IsConfigurator: true },
          { Pid: "1627207", Vid: "28320", PropertyName: "Color", Value: "Ivory", OriginalValue: "米白色", MiniImageUrl: "/placeholder-product.svg?color=ivory", IsConfigurator: true },
          { Pid: "20509", Vid: "28314", PropertyName: "Size", Value: "Small", OriginalValue: "小号", IsConfigurator: true },
          { Pid: "20509", Vid: "28315", PropertyName: "Size", Value: "Medium", OriginalValue: "中号", IsConfigurator: true },
          { Pid: "20509", Vid: "28316", PropertyName: "Size", Value: "Large", OriginalValue: "大号", IsConfigurator: true }
        ],
        ConfiguredItems: [
          devConfiguredItem("navy-s", "28341", "28314", 18.8, 42),
          devConfiguredItem("navy-m", "28341", "28315", 20.2, 18),
          devConfiguredItem("navy-l", "28341", "28316", 22.5, 0),
          devConfiguredItem("ivory-s", "28320", "28314", 18.8, 31),
          devConfiguredItem("ivory-m", "28320", "28315", 20.2, 9),
          devConfiguredItem("ivory-l", "28320", "28316", 22.5, 4)
        ]
      }
    },
    devMock: true
  };
}

function devConfiguredItem(id: string, colorVid: string, sizeVid: string, price: number, quantity: number) {
  return { Id: id, Price: { OriginalPrice: price }, Quantity: quantity, Configurators: [{ Pid: "1627207", Vid: colorVid }, { Pid: "20509", Vid: sizeVid }] };
}

function hostMatches(host: string, domain: string) {
  return host === domain || host.endsWith(`.${domain}`);
}

export function normalize1688ItemId(input: string): string {
  const value = input.trim();
  const alreadyNormalized = /^abb-(\d+)$/i.exec(value);
  if (alreadyNormalized) return `abb-${alreadyNormalized[1]}`;
  if (/^\d+$/.test(value)) return `abb-${value}`;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw invalid1688ItemId();
  }

  if (!hostMatches(parsed.hostname.toLowerCase(), "1688.com")) throw invalid1688ItemId();
  const offerId = extract1688OfferId(parsed);
  if (!offerId) throw invalid1688ItemId();
  return `abb-${offerId}`;
}

function invalid1688ItemId() {
  return new ProductProviderError("invalid_link", "Invalid 1688 product URL or offer ID.");
}

function extract1688OfferId(parsed: URL) {
  const offerFromPath = /^\/offer\/(\d+)\.html$/i.exec(parsed.pathname)?.[1];
  if (offerFromPath) return offerFromPath;
  const offerFromQuery = parsed.searchParams.get("offerId");
  return offerFromQuery && /^\d+$/.test(offerFromQuery) ? offerFromQuery : undefined;
}

function extractProviderItemId(parsed: URL) {
  return parsed.searchParams.get("id") ?? parsed.searchParams.get("itemId") ?? parsed.searchParams.get("offerId") ?? parsed.pathname.match(/(?:offer|item)\/(\d+)/)?.[1] ?? parsed.pathname.match(/(\d+)\.html/)?.[1];
}

function logDevelopmentLookup(nodeEnv: string | undefined, identity: ProductLinkIdentity, otapiItemId: string) {
  if (nodeEnv !== "development") return;
  console.info("Product provider lookup", {
    provider: identity.source === "alibaba1688" ? "1688" : identity.source,
    offerId: identity.source === "alibaba1688" ? identity.providerItemId : undefined,
    otapiItemId
  });
}

function normalizeImages(result: Record<string, unknown>) {
  const rawImages = result.Pictures ?? result.Images ?? result.images;
  const imageRecord = asRecord(rawImages);
  const nestedImages = asRecord(imageRecord.Items).Content ?? imageRecord.Content;
  const images = Array.isArray(rawImages) ? rawImages : Array.isArray(nestedImages) ? nestedImages : [];
  const normalized = images.map((image) => {
    const item = asRecord(image);
    return firstString(item.Url, item.url, image);
  }).filter((image): image is string => Boolean(image));
  const primary = firstString(result.MainPictureUrl, result.main_picture_url, result.ImageUrl, result.image_url);
  return [...new Set(primary ? [primary, ...normalized] : normalized)].slice(0, 8);
}

function normalizeSkus(result: Record<string, unknown>) {
  const rawSkus = firstArray(result.ConfiguredItems, result.Configurations, result.Skus, result.skus);
  const fallbackPrice = optionalNumber(asRecord(result.Price).OriginalPrice ?? asRecord(result.Price).price ?? result.price) ?? 0;
  if (!rawSkus) {
    return [{ id: "default", providerSkuId: "default", label: "Default", attributes: {}, priceCny: fallbackPrice }];
  }

  const attributesById = buildAttributeLookup(result.Attributes);
  return rawSkus.slice(0, MAX_NORMALIZED_SKUS).flatMap((rawSku, index) => {
    const sku = asRecord(rawSku);
    const price = asRecord(sku.Price);
    const providerSkuId = firstString(sku.Id, sku.id, sku.SkuId, sku.sku_id);
    if (!providerSkuId) return [];
    const resolvedConfigurators = configuratorAttributes(sku.Configurators, attributesById);
    const attributes = resolvedConfigurators?.attributes ?? stringRecord(sku.Attributes ?? sku.attributes);
    const label = firstString(sku.DisplayName, sku.label, sku.Title, sku.title) ?? (Object.values(attributes).join(" / ") || `Option ${index + 1}`);
    return [{
      id: providerSkuId,
      providerSkuId,
      label,
      attributes,
      priceCny: optionalNumber(price.OriginalPrice ?? price.Price ?? sku.price) ?? fallbackPrice,
      availableQuantity: optionalNumber(sku.Quantity ?? sku.available_quantity),
      imageUrl: firstString(sku.ImageUrl, sku.image_url, asRecord(sku.Image).Url, asRecord(sku.image).url, asRecord(sku.Picture).Url, resolvedConfigurators?.imageUrl)
    }];
  });
}

function firstArray(...values: unknown[]) {
  return values.find(Array.isArray) as unknown[] | undefined;
}

function buildAttributeLookup(value: unknown) {
  const lookup = new Map<string, Record<string, unknown>>();
  if (!Array.isArray(value)) return lookup;
  for (const rawAttribute of value) {
    const attribute = asRecord(rawAttribute);
    const pid = firstString(attribute.Pid, attribute.pid);
    const vid = firstString(attribute.Vid, attribute.vid);
    if (pid && vid) lookup.set(`${pid}:${vid}`, attribute);
  }
  return lookup;
}

function configuratorAttributes(value: unknown, lookup: Map<string, Record<string, unknown>>) {
  if (!Array.isArray(value)) return undefined;
  let imageUrl: string | undefined;
  const attributes = Object.fromEntries(value.flatMap((rawConfigurator) => {
    const configurator = asRecord(rawConfigurator);
    const pid = firstString(configurator.Pid, configurator.pid);
    const vid = firstString(configurator.Vid, configurator.vid);
    const definition = pid && vid ? lookup.get(`${pid}:${vid}`) : undefined;
    const name = firstString(definition?.PropertyName, definition?.OriginalPropertyName, configurator.Name, configurator.name, pid);
    const option = firstString(definition?.Value, definition?.OriginalValue, configurator.Value, configurator.value, vid);
    imageUrl ??= firstString(definition?.ImageUrl, definition?.MiniImageUrl);
    return name && option ? [[name, option]] : [];
  }));
  return { attributes, imageUrl };
}

function normalizePriceRange(result: Record<string, unknown>, productPrice: Record<string, unknown>, skus: ResolvedProduct["skus"]) {
  const explicitMin = optionalNumber(productPrice.MinPrice ?? productPrice.min_price ?? result.price_min ?? result.MinPrice);
  const explicitMax = optionalNumber(productPrice.MaxPrice ?? productPrice.max_price ?? result.price_max ?? result.MaxPrice);
  const skuPrices = skus.map((sku) => sku.priceCny).filter(Number.isFinite);
  const itemPrice = optionalNumber(productPrice.OriginalPrice ?? productPrice.PriceWithoutDelivery ?? productPrice.OneItemPriceWithoutDelivery ?? productPrice.Price);
  return {
    min: explicitMin ?? (skuPrices.length ? Math.min(...skuPrices) : itemPrice),
    max: explicitMax ?? (skuPrices.length ? Math.max(...skuPrices) : itemPrice)
  };
}

function normalizeDeliveryCost(result: Record<string, unknown>, productPrice: Record<string, unknown>) {
  const deliveryCosts = firstArray(result.DeliveryCosts, result.delivery_costs) ?? [];
  const costs = deliveryCosts.flatMap((entry) => {
    const record = asRecord(entry);
    const value = optionalNumber(record.Price ?? record.DeliveryPrice ?? entry);
    return value === undefined ? [] : [value];
  });
  return numberOrZero(costs[0] ?? asRecord(result.DeliveryCost).Price ?? productPrice.DeliveryPrice ?? productPrice.OneItemDeliveryPrice ?? result.delivery_cost ?? result.domestic_delivery_cny);
}

function readProviderFailure(payload: unknown) {
  const root = asRecord(payload);
  const code = firstString(root.ErrorCode, root.errorCode, root.error_code);
  if (!code) return undefined;
  const normalizedCode = code.trim().toLowerCase();
  // OTAPI includes ErrorCode: "Ok" in successful HTTP-200 responses. It is
  // status metadata, not an error envelope, when the Result payload is usable.
  if (["ok", "success", "0"].includes(normalizedCode)) return undefined;
  const subError = asRecord(root.SubErrorCode ?? root.subErrorCode);
  const subcode = firstString(subError.Value, subError.value, root.SubErrorCode, root.sub_error_code);
  const itemIsNotComplete = normalizedCode === "notavailable" && subcode?.toLowerCase() === "itemisnotcomplete";
  return {
    code,
    subcode,
    itemIsNotComplete,
    retryable: itemIsNotComplete || normalizedCode === "notavailable",
    message: firstString(root.ErrorDescription, root.error_description, root.Message, root.message)
  };
}

function retryExhaustedError(identity: ProductLinkIdentity, attempts: number, rawPayload: unknown, reason: string) {
  const failure = readProviderFailure(rawPayload);
  return new ProductProviderError("lookup_failed", "The supplier is still preparing this product. Please retry shortly.", {
    source: identity.source, retryable: true, attempts, maxAttempts: PROVIDER_LOOKUP_MAX_ATTEMPTS, retryAfterSeconds: 5,
    retryReason: reason, providerCode: failure?.code, providerSubcode: failure?.subcode
  }, rawPayload);
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function optionalNumber(value: unknown) {
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(number) ? number : undefined;
}

function numberOrZero(value: unknown) {
  return optionalNumber(value) ?? 0;
}

function stringRecord(value: unknown) {
  const record = asRecord(value);
  return Object.fromEntries(Object.entries(record).flatMap(([key, item]) => typeof item === "string" || typeof item === "number" || typeof item === "boolean" ? [[key, String(item)]] : []));
}
