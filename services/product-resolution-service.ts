import type { ResolvedProduct } from "../lib/domain/types";

export type PersistedProductSku = {
  skuId: string;
  providerSkuId?: string;
  label: string;
  attributes: Record<string, string>;
  priceCny: number;
  availableQuantity?: number;
  imageUrl?: string;
};

export type PersistedProductResolution = Omit<ResolvedProduct, "raw" | "source" | "skus"> & {
  productId: string;
  skus: PersistedProductSku[];
};

export type ProductResolutionResult = PersistedProductResolution & {
  resolutionMeta: {
    source: "provider" | "persisted_snapshot";
    cached: boolean;
    snapshotAgeSeconds?: number;
    timings: {
      providerMs: number;
      persistenceMs?: number;
      totalMs: number;
    };
  };
};

export type ProductResolutionRepository = {
  startAttempt(input: { provider: string; actorId: string; url: string; providerItemId?: string }): Promise<string>;
  persistSnapshot(input: { actorId: string; product: ResolvedProduct }): Promise<PersistedProductResolution>;
  findFreshSnapshot(input: { provider: string; providerItemId: string; maxAgeMs: number }): Promise<{ product: PersistedProductResolution; ageMs: number } | null>;
  completeAttempt(input: { attemptId: string; status: "success" | "failed" | "manual_required"; rawPayload?: unknown; errorMessage?: string; productId?: string }): Promise<void>;
};

const SNAPSHOT_FALLBACK_MAX_AGE_MS = 15 * 60 * 1000;

export async function resolveAndPersistProduct(
  input: { actorId: string; url: string },
  dependencies: { repository: ProductResolutionRepository; resolveProvider: (url: string) => Promise<ResolvedProduct> }
) {
  const startedAt = Date.now();
  let providerMs = 0;
  let provider = "unknown";
  let providerItemId: string | undefined;
  try {
    const identity = identifyAttempt(input.url);
    provider = identity.provider;
    providerItemId = identity.providerItemId;
  } catch {
    // The provider error is recorded after the integration attempt is opened.
  }

  const attemptId = await dependencies.repository.startAttempt({ provider, actorId: input.actorId, url: input.url, providerItemId });
  try {
    const providerStartedAt = Date.now();
    let product: ResolvedProduct;
    try {
      product = await dependencies.resolveProvider(input.url);
    } finally {
      providerMs = Date.now() - providerStartedAt;
    }
    const persistenceStartedAt = Date.now();
    const persisted = await dependencies.repository.persistSnapshot({ actorId: input.actorId, product });
    const persistenceMs = Date.now() - persistenceStartedAt;
    await dependencies.repository.completeAttempt({ attemptId, status: "success", rawPayload: product.raw, productId: persisted.productId });
    return {
      ...persisted,
      resolutionMeta: { source: "provider", cached: false, timings: { providerMs, persistenceMs, totalMs: Date.now() - startedAt } }
    } satisfies ProductResolutionResult;
  } catch (error) {
    const providerError = asProviderError(error);
    if (providerError?.kind === "lookup_failed" && providerError.details?.retryable === true && provider !== "unknown" && providerItemId) {
      const fallback = await dependencies.repository.findFreshSnapshot({ provider, providerItemId, maxAgeMs: SNAPSHOT_FALLBACK_MAX_AGE_MS });
      if (fallback) {
        await dependencies.repository.completeAttempt({
          attemptId,
          status: "success",
          productId: fallback.product.productId,
          rawPayload: { resolutionSource: "persisted_snapshot", snapshotAgeSeconds: Math.max(0, Math.round(fallback.ageMs / 1000)) }
        });
        return {
          ...fallback.product,
          resolutionMeta: {
            source: "persisted_snapshot",
            cached: true,
            snapshotAgeSeconds: Math.max(0, Math.round(fallback.ageMs / 1000)),
            timings: { providerMs, totalMs: Date.now() - startedAt }
          }
        } satisfies ProductResolutionResult;
      }
    }
    await dependencies.repository.completeAttempt({
      attemptId,
      status: providerError?.kind === "manual_review_required" ? "manual_required" : "failed",
      rawPayload: providerError?.rawPayload,
      errorMessage: error instanceof Error ? error.message : "Unknown product resolution failure."
    });
    throw error;
  }
}

function identifyAttempt(url: string) {
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  const provider = host === "1688.com" || host.endsWith(".1688.com") ? "alibaba1688" : host === "taobao.com" || host.endsWith(".taobao.com") || host === "tmall.com" || host.endsWith(".tmall.com") ? "taobao" : "unknown";
  const providerItemId = parsed.searchParams.get("id") ?? parsed.searchParams.get("itemId") ?? parsed.searchParams.get("offerId") ?? parsed.pathname.match(/(?:offer|item)\/(\d+)/)?.[1] ?? parsed.pathname.match(/(\d+)\.html/)?.[1];
  return { provider, providerItemId };
}

function asProviderError(error: unknown) {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { kind?: unknown; rawPayload?: unknown; details?: Record<string, unknown> };
  return typeof candidate.kind === "string" ? candidate as { kind: string; rawPayload?: unknown; details?: Record<string, unknown> } : undefined;
}
