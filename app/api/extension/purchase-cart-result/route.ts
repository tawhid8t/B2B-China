import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { extensionCorsPreflight, extensionCorsResponse } from "@/lib/api/extension-cors";
import { authorizeExtensionApiRequest } from "@/lib/auth/extension-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const bodySchema = z.object({
  purchaseTaskId: z.string().uuid(),
  cartAdded: z.boolean(),
  message: z.string().trim().min(1).max(2000).optional(),
  skuResults: z.array(z.object({ orderItemId: z.string().uuid(), prepared: z.boolean() })).min(1),
}).superRefine((value, context) => {
  if (value.cartAdded && !value.skuResults.every((line) => line.prepared)) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Every SKU must be prepared before reporting a cart addition.", path: ["skuResults"] });
  }
  if (!value.cartAdded && !value.message) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "A failure message is required when the cart was not updated.", path: ["message"] });
  }
});

export async function POST(request: Request) {
  const authorization = await authorizeExtensionApiRequest(request);
  if (!authorization.authorized) return extensionCorsResponse(request, authorization.response);
  let payload: unknown;
  try { payload = await request.json(); } catch { return extensionCorsResponse(request, apiError("VALIDATION_ERROR", "A JSON request body is required.", 400)); }
  const body = bodySchema.safeParse(payload);
  if (!body.success) return extensionCorsResponse(request, apiError("VALIDATION_ERROR", "Invalid cart result payload.", 400, body.error.flatten()));

  try {
    const rpc = authorization.kind === "credential"
      ? "record_purchase_task_cart_result_for_credential"
      : "record_purchase_task_cart_result";
    const client = authorization.kind === "credential" ? createSupabaseAdminClient() : authorization.context.supabase;
    const args = authorization.kind === "credential"
      ? { p_profile_id: authorization.context.profileId, p_purchase_task_id: body.data.purchaseTaskId, p_order_item_ids: body.data.skuResults.map((line) => line.orderItemId), p_cart_added: body.data.cartAdded, p_message: body.data.message ?? null }
      : { p_purchase_task_id: body.data.purchaseTaskId, p_order_item_ids: body.data.skuResults.map((line) => line.orderItemId), p_cart_added: body.data.cartAdded, p_message: body.data.message ?? null };
    const { data, error } = await client.rpc(rpc, args);
    if (error) return extensionCorsResponse(request, databaseErrorResponse(error, "CONFLICT", "Cart result could not be recorded."));
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return extensionCorsResponse(request, apiError("INTERNAL_ERROR", "Cart result returned no task.", 500));
    return extensionCorsResponse(request, apiSuccess({ purchaseTaskId: row.purchase_task_id, state: row.purchase_task_state, updatedAt: row.updated_at }));
  } catch (error) {
    return extensionCorsResponse(request, databaseErrorResponse(error, "CONFLICT", "Cart result could not be recorded."));
  }
}

export function OPTIONS(request: Request) { return extensionCorsPreflight(request); }
