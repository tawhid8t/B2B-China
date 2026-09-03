import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { OWNER_ROLES } from "@/lib/auth/roles";
import { createPaymentInstruction, getPaymentSettings } from "@/services/admin-payment-service";
import { paymentInstructionSchema } from "@/lib/payments/settings-validation";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, OWNER_ROLES);
  if (!authorization.authorized) return authorization.response;
  try { return apiSuccess((await getPaymentSettings(authorization.context)).instructions); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, OWNER_ROLES);
  if (!authorization.authorized) return authorization.response;
  let json: unknown;
  try { json = await request.json(); } catch { return apiError("VALIDATION_ERROR", "Payment-instruction payload is invalid.", 400); }
  const body = paymentInstructionSchema.safeParse(json);
  if (!body.success) return apiError("VALIDATION_ERROR", "A method, label, and destination are required.", 400, body.error.flatten());
  try { return apiSuccess(await createPaymentInstruction(authorization.context, body.data), {}, 201); }
  catch (error) { return databaseErrorResponse(error); }
}
