import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid product order ID.", 400);
  const { data, error } = await authorization.context.supabase.rpc("confirm_product_order_for_purchase", { p_product_order_id: parsed.data.id });
  if (error) return databaseErrorResponse(error, "CONFLICT", "Product order could not be confirmed.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiError("INTERNAL_ERROR", "Confirmation returned no result.", 500);
  return apiSuccess({ productOrderId: row.product_order_id, purchaseBatchId: row.purchase_batch_id, orderItemIds: row.order_item_ids, status: row.order_status });
}
