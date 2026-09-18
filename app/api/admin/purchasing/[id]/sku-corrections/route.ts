import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const attributesSchema = z.record(z.string().trim().min(1).max(160), z.string().trim().min(1).max(500)).refine((attributes) => Object.keys(attributes).length > 0, "At least one supplier attribute is required.");
const bodySchema = z.object({
  reason: z.string().trim().min(1).max(2000),
  corrections: z.array(z.object({ orderItemId: z.string().uuid(), providerAttributes: attributesSchema })).min(1).max(500)
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid purchase task ID.", 400);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return apiError("VALIDATION_ERROR", "Every SKU needs its exact supplier attributes and a reason.", 400, parsedBody.error.flatten());
  const { data, error } = await authorization.context.supabase.rpc("correct_purchase_task_sku_attributes", {
    p_purchase_task_id: parsedParams.data.id,
    p_corrections: parsedBody.data.corrections,
    p_reason: parsedBody.data.reason
  });
  if (error) return databaseErrorResponse(error, "CONFLICT", "Supplier SKU attributes could not be corrected.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiError("INTERNAL_ERROR", "Supplier SKU correction returned no result.", 500);
  return apiSuccess({ purchaseTaskId: row.purchase_task_id, state: row.purchase_task_state, updatedAt: row.updated_at });
}
