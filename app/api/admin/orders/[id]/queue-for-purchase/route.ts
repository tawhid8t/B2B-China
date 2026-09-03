import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid order item ID.", 400);

  const { data: order, error: orderError } = await authorization.context.supabase
    .from("order_items")
    .select("product_order_id")
    .eq("id", parsedParams.data.id)
    .maybeSingle();
  if (orderError) return databaseErrorResponse(orderError, "PROVIDER_SYNC_FAILED", "Order could not be queued for purchase.");
  if (!order?.product_order_id) return apiError("NOT_FOUND", "Order item was not found.", 404);
  const { data, error } = await authorization.context.supabase.rpc("confirm_product_order_for_purchase", {
    p_product_order_id: order.product_order_id,
  });
  if (error) return databaseErrorResponse(error, "PROVIDER_SYNC_FAILED", "Order could not be queued for purchase.");

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiError("INTERNAL_ERROR", "Purchase queue operation returned no result.", 500);
  return apiSuccess({
    purchaseBatchId: row.purchase_batch_id,
    orderItemId: parsedParams.data.id,
    productOrderId: row.product_order_id,
    status: row.order_status,
  });
}
