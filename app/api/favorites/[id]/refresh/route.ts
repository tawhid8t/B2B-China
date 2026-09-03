import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveProductFromProvider, ProductProviderError } from "@/services/otapi-service";
import { resolveAndPersistProduct } from "@/services/product-resolution-service";
import { createSupabaseProductRepository } from "@/services/supabase-product-repository";
import { z } from "zod";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(_request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "A valid favorite ID is required.", 400);
  const { data: favorite, error } = await authorization.context.supabase.from("client_favorites").select("id, source_product_link_id").eq("id", id.data).eq("status", "active").single();
  if (error || !favorite) return apiError("NOT_FOUND", "Favorite not found.", 404);
  const { data: productLink } = await authorization.context.supabase.from("product_links").select("original_url").eq("id", favorite.source_product_link_id).single();
  const url = productLink?.original_url;
  if (!url) return apiError("MANUAL_REVIEW_REQUIRED", "This favorite has no refreshable supplier link.", 422);
  try {
    const admin = createSupabaseAdminClient();
    const product = await resolveAndPersistProduct({ actorId: authorization.context.user.id, url }, { repository: createSupabaseProductRepository(admin), resolveProvider: resolveProductFromProvider });
    const { data: client } = await authorization.context.supabase.from("clients").select("id").eq("profile_id", authorization.context.user.id).single();
    if (!client) return apiError("FORBIDDEN", "Client profile not found.", 403);
    const { data: refresh, error: insertError } = await admin.from("favorite_refreshes").insert({ favorite_id: id.data, client_id: client.id, status: "resolved", resolved_product_link_id: product.productId, provider_sku_match_status: "selection_required", resolved_at: new Date().toISOString(), expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() }).select("id,status,resolved_product_link_id,provider_sku_match_status,expires_at").single();
    if (insertError) throw insertError;
    return apiSuccess(refresh);
  } catch (error) {
    if (error instanceof ProductProviderError) return apiError("PROVIDER_LOOKUP_FAILED", error.message, 422);
    return apiError("PROVIDER_LOOKUP_FAILED", "Unable to refresh this favorite right now.", 503);
  }
}
