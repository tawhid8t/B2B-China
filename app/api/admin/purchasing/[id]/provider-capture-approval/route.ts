import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), note: z.string().trim().max(2000).optional() }),
  z.object({ action: z.literal("return_to_review"), reason: z.string().trim().min(1).max(2000) }),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid purchase task ID.", 400);
  const parsedBody = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return apiError("VALIDATION_ERROR", "Invalid provider-capture approval request.", 400, parsedBody.error.flatten());
  const args = parsedBody.data.action === "approve"
    ? { p_purchase_task_id: parsedParams.data.id, p_note: parsedBody.data.note ?? null }
    : { p_purchase_task_id: parsedParams.data.id, p_reason: parsedBody.data.reason };
  const rpc = parsedBody.data.action === "approve" ? "approve_provider_purchase_capture" : "return_provider_capture_to_review";
  const { data, error } = await authorization.context.supabase.rpc(rpc, args);
  if (error) return databaseErrorResponse(error, "CONFLICT", "Provider capture could not be updated.");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return apiError("INTERNAL_ERROR", "Provider-capture update returned no result.", 500);
  return apiSuccess({ purchaseTaskId: row.purchase_task_id, state: row.purchase_task_state, providerCaptureId: row.provider_capture_id ?? null, updatedAt: row.approved_at ?? row.updated_at });
}
