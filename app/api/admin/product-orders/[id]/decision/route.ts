import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  decision: z.enum(["cancelled", "exception"]),
  reason: z.string().trim().min(1).max(2000),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid product order ID.", 400);

  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return apiError("VALIDATION_ERROR", "A decision and reason are required.", 400, parsedBody.error.flatten());

  const { data, error } = await authorization.context.supabase.rpc("decide_product_order_review", {
    p_product_order_id: parsedParams.data.id,
    p_decision: parsedBody.data.decision,
    p_reason: parsedBody.data.reason,
  });
  if (error) return databaseErrorResponse(error, "CONFLICT", "Product order review decision could not be recorded.");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiError("INTERNAL_ERROR", "Review decision returned no result.", 500);
  return apiSuccess({
    productOrderId: row.product_order_id,
    orderItemIds: row.order_item_ids,
    status: row.order_status,
  });
}
