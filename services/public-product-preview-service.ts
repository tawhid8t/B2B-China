import { identifyProductSource, ProductProviderError, resolveProductFromProvider } from "./product-provider-service.ts";
import type { ResolvedProduct } from "../lib/domain/types.ts";

export type PublicProductPreview = Omit<ResolvedProduct, "raw" | "source">;

type PreviewCacheEntry = {
  expiresAt: number;
  product: PublicProductPreview;
};

type PreviewOptions = {
  resolveProvider?: (url: string) => Promise<ResolvedProduct>;
  cache?: Map<string, PreviewCacheEntry>;
  now?: () => number;
  cacheTtlMs?: number;
};

const previewCache = new Map<string, PreviewCacheEntry>();
const previewCacheTtlMs = 5 * 60 * 1000;
const maxPreviewCacheEntries = 500;

export async function resolvePublicProductPreview(url: string, options: PreviewOptions = {}) {
  const identity = identifyProductSource(url);
  const now = options.now ?? Date.now;
  const cache = options.cache ?? previewCache;
  const cached = cache.get(identity.originalUrl);
  if (cached && cached.expiresAt > now()) return { product: cached.product, cached: true };

  const resolved = await (options.resolveProvider ?? resolveProductFromProvider)(identity.originalUrl);
  const product = toPublicProductPreview(resolved);
  if (!cache.has(identity.originalUrl) && cache.size >= maxPreviewCacheEntries) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(identity.originalUrl, { product, expiresAt: now() + (options.cacheTtlMs ?? previewCacheTtlMs) });
  return { product, cached: false };
}

export function createPreviewRateLimiter({ limit = 20, windowMs = 60 * 1000, maxKeys = 10_000 } = {}) {
  const buckets = new Map<string, { startedAt: number; count: number }>();

  return {
    check(key: string, now = Date.now()) {
      const current = buckets.get(key);
      if (!current || now - current.startedAt >= windowMs) {
        if (!current && buckets.size >= maxKeys) {
          const oldestKey = buckets.keys().next().value;
          if (oldestKey) buckets.delete(oldestKey);
        }
        buckets.set(key, { startedAt: now, count: 1 });
        return { allowed: true, retryAfterSeconds: 0 };
      }

      if (current.count >= limit) {
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (now - current.startedAt)) / 1000)) };
      }

      current.count += 1;
      return { allowed: true, retryAfterSeconds: 0 };
    }
  };
}

export const publicPreviewRateLimiter = createPreviewRateLimiter();

export function toPublicProductPreview(product: ResolvedProduct): PublicProductPreview {
  const { raw: _raw, source: _source, ...publicProduct } = product;
  return publicProduct;
}

export function isProductProviderError(error: unknown): error is ProductProviderError {
  return error instanceof ProductProviderError;
}
