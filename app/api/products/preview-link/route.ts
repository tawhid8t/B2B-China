import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { isProductProviderError, publicPreviewRateLimiter, resolvePublicProductPreview } from "@/services/public-product-preview-service";

const bodySchema = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }

  const body = bodySchema.safeParse(payload);
  if (!body.success) return apiError("VALIDATION_ERROR", "A valid product URL is required.", 400, body.error.flatten());

  const rateLimit = publicPreviewRateLimiter.check(getClientKey(request));
  if (!rateLimit.allowed) {
    return apiError("PROVIDER_LOOKUP_FAILED", "Preview limit reached. Try again shortly.", 429, { retryAfterSeconds: rateLimit.retryAfterSeconds });
  }

  try {
    const result = await resolvePublicProductPreview(body.data.url);
    const response = apiSuccess(result.product, { cached: result.cached });
    response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=600");
    return response;
  } catch (error) {
    if (isProductProviderError(error)) {
      if (error.kind === "invalid_link") return apiError("VALIDATION_ERROR", error.message, 400, error.details);
      if (error.kind === "unsupported_source") return apiError("PROVIDER_LOOKUP_FAILED", error.message, 422, error.details);
      if (error.kind === "manual_review_required") return apiError("MANUAL_REVIEW_REQUIRED", error.message, 422, error.details);
      return apiError("PROVIDER_LOOKUP_FAILED", error.message, 502, error.details);
    }
    return apiError("MANUAL_REVIEW_REQUIRED", "Unable to preview this product automatically. Submit it for manual review.", 503);
  }
}

function getClientKey(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")?.trim()
    || "unknown-client";
}
