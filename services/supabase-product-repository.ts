import type { SupabaseClient } from "@supabase/supabase-js";
import type { ResolvedProduct } from "@/lib/domain/types";
import type { PersistedProductResolution, ProductResolutionRepository } from "@/services/product-resolution-service";

type DatabaseError = { message: string; code?: string; details?: string; hint?: string };

export function createSupabaseProductRepository(supabase: SupabaseClient): ProductResolutionRepository {
  return {
    async startAttempt(input) {
      const { data, error } = await supabase.from("integration_logs").insert({
        provider: input.provider,
        operation: "resolve_product_link",
        request_payload: { url: input.url, actorId: input.actorId, providerItemId: input.providerItemId },
        status: "pending"
      }).select("id").single();
      if (error || !data) throwDatabaseError(error, "Could not create the product integration log.");
      return data.id as string;
    },

    async persistSnapshot({ actorId, product }) {
      const snapshot = {
        originalUrl: product.originalUrl,
        provider: product.provider,
        providerItemId: product.providerItemId,
        title: product.title,
        titleCn: product.titleCn ?? null,
        images: product.images,
        category: product.category,
        domesticDeliveryCny: product.domesticDeliveryCny,
        priceMinCny: product.priceMinCny ?? null,
        priceMaxCny: product.priceMaxCny ?? null,
        raw: product.raw ?? {},
        skus: product.skus.map((sku) => ({
          id: sku.id,
          providerSkuId: sku.providerSkuId ?? sku.id,
          label: sku.label,
          attributes: sku.attributes,
          priceCny: sku.priceCny,
          availableQuantity: sku.availableQuantity ?? null,
          imageUrl: sku.imageUrl ?? null
        }))
      };
      const { data, error } = await supabase.rpc("persist_product_snapshot", {
        p_actor_id: actorId,
        p_product: snapshot
      });
      if (error || !isPersistedSnapshot(data)) throwDatabaseError(error, "Could not persist the product snapshot.");
      return normalizePersistedSnapshot(data);
    },

    async findFreshSnapshot({ provider, providerItemId, maxAgeMs }) {
      const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
      const { data: productRow, error: productError } = await supabase.from("product_links")
        .select("id, provider, provider_item_id, original_url, title, title_cn, images, category, domestic_delivery_cny, price_min_cny, price_max_cny, updated_at")
        .eq("provider", provider)
        .eq("provider_item_id", providerItemId)
        .eq("source_status", "active")
        .gte("updated_at", cutoff)
        .maybeSingle();
      if (productError) throwDatabaseError(productError, "Could not inspect the recent product snapshot.");
      if (!productRow || !isRealTitle(productRow.title) || !isImageList(productRow.images)) return null;

      const { data: skuRows, error: skuError } = await supabase.from("product_skus")
        .select("id, provider_sku_id, label, attributes, price_cny, available_quantity, image_url")
        .eq("product_link_id", productRow.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (skuError) throwDatabaseError(skuError, "Could not load the recent product SKUs.");
      if (!skuRows?.length || skuRows.some((sku) => !sku.id || !sku.label || !Number.isFinite(Number(sku.price_cny)))) return null;

      const updatedAt = Date.parse(productRow.updated_at);
      if (!Number.isFinite(updatedAt)) return null;
      return {
        ageMs: Math.max(0, Date.now() - updatedAt),
        product: {
          productId: String(productRow.id),
          provider: productRow.provider,
          providerItemId: productRow.provider_item_id,
          originalUrl: productRow.original_url,
          title: productRow.title,
          titleCn: productRow.title_cn ?? undefined,
          images: productRow.images as string[],
          category: productRow.category,
          domesticDeliveryCny: Number(productRow.domestic_delivery_cny),
          priceMinCny: productRow.price_min_cny === null ? undefined : Number(productRow.price_min_cny),
          priceMaxCny: productRow.price_max_cny === null ? undefined : Number(productRow.price_max_cny),
          skus: skuRows.map((sku) => ({
            skuId: String(sku.id),
            providerSkuId: sku.provider_sku_id ?? undefined,
            label: sku.label,
            attributes: sku.attributes as Record<string, string>,
            priceCny: Number(sku.price_cny),
            availableQuantity: sku.available_quantity ?? undefined,
            imageUrl: sku.image_url ?? undefined
          }))
        } satisfies PersistedProductResolution
      };
    },

    async completeAttempt(input) {
      const { error } = await supabase.from("integration_logs").update({
        status: input.status,
        response_payload: input.rawPayload ?? (input.productId ? { productId: input.productId } : {}),
        error_message: input.errorMessage ?? null
      }).eq("id", input.attemptId);
      if (error) throwDatabaseError(error, "Could not complete the product integration log.");
    }
  };
}

function isRealTitle(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.trim().toLowerCase() !== "imported product";
}

function isImageList(value: unknown): value is string[] {
  return Array.isArray(value) && value.some((image) => typeof image === "string" && image.trim().length > 0);
}

function isPersistedSnapshot(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function normalizePersistedSnapshot(value: Record<string, unknown>): PersistedProductResolution {
  const skus = Array.isArray(value.skus) ? value.skus : [];
  if (!value.productId || !value.provider || !value.providerItemId || !value.originalUrl || !value.title || !Array.isArray(value.images) || skus.length === 0) {
    throw new Error("The persisted product snapshot response was incomplete.");
  }
  if (value.provider !== "alibaba1688" && value.provider !== "taobao") {
    throw new Error("The persisted product snapshot returned an unsupported provider.");
  }
  return {
    productId: String(value.productId),
    provider: value.provider,
    providerItemId: String(value.providerItemId),
    originalUrl: String(value.originalUrl),
    title: String(value.title),
    titleCn: value.titleCn ? String(value.titleCn) : undefined,
    images: value.images.map(String),
    category: String(value.category ?? "default"),
    domesticDeliveryCny: Number(value.domesticDeliveryCny ?? 0),
    priceMinCny: value.priceMinCny === null || value.priceMinCny === undefined ? undefined : Number(value.priceMinCny),
    priceMaxCny: value.priceMaxCny === null || value.priceMaxCny === undefined ? undefined : Number(value.priceMaxCny),
    skus: skus.map((entry) => {
      const sku = entry as Record<string, unknown>;
      return {
        skuId: String(sku.skuId),
        providerSkuId: sku.providerSkuId ? String(sku.providerSkuId) : undefined,
        label: String(sku.label),
        attributes: sku.attributes as Record<string, string>,
        priceCny: Number(sku.priceCny),
        availableQuantity: sku.availableQuantity === null || sku.availableQuantity === undefined ? undefined : Number(sku.availableQuantity),
        imageUrl: sku.imageUrl ? String(sku.imageUrl) : undefined
      };
    })
  };
}

function throwDatabaseError(error: DatabaseError | null, fallback: string): never {
  const detail = error ? [error.message, error.details, error.hint].filter(Boolean).join(" ") : fallback;
  throw new Error(detail || fallback);
}
