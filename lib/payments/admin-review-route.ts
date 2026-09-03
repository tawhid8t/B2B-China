import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { reviewPaymentProof } from "@/services/admin-payment-service";
import { z } from "zod";

const schema = z.object({ reason: z.string().trim().min(1).max(1000) });

export async function paymentDecision(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  action: "reject" | "needs_review" | "cancel",
) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  let json: unknown;
  try { json = await request.json(); } catch { return apiError("VALIDATION_ERROR", "A review reason is required.", 400); }
  const body = schema.safeParse(json);
  if (!body.success) return apiError("VALIDATION_ERROR", "A review reason is required.", 400, body.error.flatten());
  const { id } = await params;
  try { return apiSuccess(await reviewPaymentProof(authorization.context, { paymentProofId: id, action, reason: body.data.reason })); }
  catch (error) { return databaseErrorResponse(error, "INTERNAL_ERROR", "Payment review could not be completed."); }
}
