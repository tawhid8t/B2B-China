import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeExtensionApiRequest } from "@/lib/auth/extension-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extensionCorsPreflight, extensionCorsResponse } from "@/lib/api/extension-cors";
import { z } from "zod";

const bodySchema = z.object({ purchaseTaskId: z.string().uuid(), header: z.object({ providerOrderId: z.string().trim().min(1), sellerName: z.string().trim().optional(), purchasedAt: z.string().datetime().optional(), domesticDeliveryCny: z.number().nonnegative(), discountCny: z.number().nonnegative(), finalPaidCny: z.number().positive(), rawCapture: z.record(z.unknown()).optional() }), lines: z.array(z.object({ orderItemId: z.string().uuid(), providerSkuId: z.string().optional(), quantity: z.number().int().positive(), actualUnitPriceCny: z.number().nonnegative(), actualSubtotalCny: z.number().nonnegative() })).min(1) });
export async function POST(request: Request) {
 const authorization = await authorizeExtensionApiRequest(request); if (!authorization.authorized) return extensionCorsResponse(request, authorization.response);
 let json: unknown; try { json = await request.json(); } catch { return extensionCorsResponse(request, apiError("VALIDATION_ERROR", "A JSON request body is required.", 400)); }
 const parsed = bodySchema.safeParse(json); if (!parsed.success) return extensionCorsResponse(request, apiError("VALIDATION_ERROR", "Invalid provider capture payload.", 400, parsed.error.flatten()));
 const rpc = authorization.kind === "credential" ? "record_provider_purchase_capture_for_credential" : "record_provider_purchase_capture";
 const client = authorization.kind === "credential" ? createSupabaseAdminClient() : authorization.context.supabase;
 const args = authorization.kind === "credential" ? { p_profile_id: authorization.context.profileId, p_purchase_task_id: parsed.data.purchaseTaskId, p_header: parsed.data.header, p_lines: parsed.data.lines } : { p_purchase_task_id: parsed.data.purchaseTaskId, p_header: parsed.data.header, p_lines: parsed.data.lines };
 const { data, error } = await client.rpc(rpc, args); if (error) return extensionCorsResponse(request, databaseErrorResponse(error, "CONFLICT", "Provider capture could not be recorded."));
 return extensionCorsResponse(request, apiSuccess({ captureId: data, purchaseTaskId: parsed.data.purchaseTaskId, state: "awaiting_admin_confirmation" }));
}
export function OPTIONS(request: Request) { return extensionCorsPreflight(request); }
