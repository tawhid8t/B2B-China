import { ProductProviderError, resolveProductFromProvider, resolveSharedProductLink } from "@/services/otapi-service";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveAndPersistProduct } from "@/services/product-resolution-service";
import { createSupabaseProductRepository } from "@/services/supabase-product-repository";
import { z } from "zod";

const bodySchema = z.object({ url: z.string().trim().min(1).max(4_000) });

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }
  const body = bodySchema.safeParse(payload);
  if (!body.success) return apiError("VALIDATION_ERROR", "A valid product URL is required.", 400, body.error.flatten());

  try {
    const canonicalUrl = await resolveSharedProductLink(body.data.url);
    const repository = createSupabaseProductRepository(createSupabaseAdminClient());
    const product = await resolveAndPersistProduct(
      { actorId: authorization.context.user.id, url: canonicalUrl },
      { repository, resolveProvider: resolveProductFromProvider }
    );
    const { resolutionMeta, ...data } = product;
    return apiSuccess(data, resolutionMeta);
  } catch (error) {
    if (error instanceof ProductProviderError) {
      if (error.kind === "invalid_link") return apiError("VALIDATION_ERROR", error.message, 400, error.details);
      if (error.kind === "unsupported_source") return apiError("PROVIDER_LOOKUP_FAILED", error.message, 422, error.details);
      if (error.kind === "lookup_failed") return apiError("PROVIDER_LOOKUP_FAILED", error.message, 503, error.details);
      return apiError("MANUAL_REVIEW_REQUIRED", error.message, 422, error.details);
    }
    return apiError("MANUAL_REVIEW_REQUIRED", "Unable to resolve product automatically. Submit it for manual review.", 503);
  }
}
