import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { OWNER_ROLES } from "@/lib/auth/roles";
import { updatePaymentInstruction } from "@/services/admin-payment-service";
import { paymentInstructionPatchSchema } from "@/lib/payments/settings-validation";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, OWNER_ROLES);
  if (!authorization.authorized) return authorization.response;
  let json: unknown;
  try { json = await request.json(); } catch { return apiError("VALIDATION_ERROR", "Payment-instruction payload is invalid.", 400); }
  const body = paymentInstructionPatchSchema.safeParse(json);
  if (!body.success) return apiError("VALIDATION_ERROR", "At least one valid setting is required.", 400, body.error.flatten());
  const { id } = await params;
  try { return apiSuccess(await updatePaymentInstruction(authorization.context, id, body.data)); }
  catch (error) { return databaseErrorResponse(error); }
}
