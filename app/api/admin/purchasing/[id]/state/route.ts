import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({ state: z.enum(["queued", "needs_review"]), reason: z.string().trim().min(1).max(2000).optional() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid purchase task ID.", 400);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return apiError("VALIDATION_ERROR", "Invalid purchase task state.", 400, parsedBody.error.flatten());
  const { data, error } = await authorization.context.supabase.rpc("set_purchase_task_state", { p_purchase_task_id: parsedParams.data.id, p_state: parsedBody.data.state, p_reason: parsedBody.data.reason ?? null });
  if (error) return databaseErrorResponse(error, "CONFLICT", "Purchase task could not be updated.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiError("INTERNAL_ERROR", "Purchase task update returned no result.", 500);
  return apiSuccess({ purchaseTaskId: row.purchase_task_id, state: row.purchase_task_state, updatedAt: row.updated_at });
}
