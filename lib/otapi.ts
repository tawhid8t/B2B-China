import { Provider, ResolvedProduct } from "@/lib/types";

const OTAPI_BASE_URL = "https://rest.otapi.net";

export function parseProviderUrl(url: string): { provider: Provider; providerItemId: string } {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const id =
    parsed.searchParams.get("id") ??
    parsed.searchParams.get("itemId") ??
    parsed.pathname.match(/(?:offer|item)\/(\d+)/)?.[1] ??
    parsed.pathname.match(/(\d+)\.html/)?.[1];

  if (!id) {
    throw new Error("Could not find a product id in the supplied link.");
  }

  if (host.includes("1688.com")) return { provider: "alibaba1688", providerItemId: id };
  if (host.includes("taobao.com") || host.includes("tmall.com")) return { provider: "taobao", providerItemId: id };

  throw new Error("Only 1688, Taobao, and Tmall product links are supported.");
}

export async function resolveProductFromOtapi(url: string): Promise<ResolvedProduct> {
  const { provider, providerItemId } = parseProviderUrl(url);
  const apiKey = process.env.OTAPI_KEY;

  if (!apiKey) {
    return mockResolvedProduct(url, provider, providerItemId);
  }

  const response = await fetch(`${OTAPI_BASE_URL}/v1/${provider}/product/${providerItemId}?language=en`, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`OTAPI product lookup failed with status ${response.status}.`);
  }

  const payload = await response.json();
  const result = payload.Result ?? payload.result ?? payload;

  return {
    provider,
    providerItemId,
    originalUrl: url,
    title: result.Title ?? result.title ?? "Imported product",
    images: normalizeImages(result),
    category: result.CategoryName ?? result.category_name ?? "default",
    domesticDeliveryCny: Number(result.DeliveryCost?.Price ?? result.delivery_cost ?? 0),
    skus: normalizeSkus(result),
    raw: payload
  };
}

function normalizeImages(result: Record<string, any>) {
  const images = result.Pictures ?? result.Images ?? result.images ?? [];
  if (Array.isArray(images)) return images.map((image) => String(image.Url ?? image.url ?? image)).filter(Boolean).slice(0, 8);
  return [];
}

function normalizeSkus(result: Record<string, any>) {
  const skus = result.Configurations ?? result.Skus ?? result.skus ?? [];
  if (Array.isArray(skus) && skus.length > 0) {
    return skus.slice(0, 24).map((sku, index) => ({
      id: String(sku.Id ?? sku.id ?? sku.SkuId ?? `sku_${index + 1}`),
      label: String(sku.DisplayName ?? sku.label ?? sku.Title ?? `Option ${index + 1}`),
      attributes: sku.Attributes ?? sku.attributes ?? {},
      priceCny: Number(sku.Price?.OriginalPrice ?? sku.price ?? result.Price?.OriginalPrice ?? 0),
      availableQuantity: Number(sku.Quantity ?? sku.available_quantity ?? 0)
    }));
  }

  return [{ id: "default", label: "Default", attributes: {}, priceCny: Number(result.Price?.OriginalPrice ?? result.price ?? 35) }];
}

function mockResolvedProduct(url: string, provider: Provider, providerItemId: string): ResolvedProduct {
  return {
    provider,
    providerItemId,
    originalUrl: url,
    title: provider === "alibaba1688" ? "1688 sourced product" : "Taobao sourced product",
    images: ["/placeholder-product.svg"],
    category: "apparel",
    domesticDeliveryCny: 8,
    skus: [
      { id: "black-m", label: "Black / M", attributes: { color: "Black", size: "M" }, priceCny: 42, availableQuantity: 120 },
      { id: "white-l", label: "White / L", attributes: { color: "White", size: "L" }, priceCny: 44, availableQuantity: 90 }
    ]
  };
}
