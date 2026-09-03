import { apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { getActivePaymentInstructions } from "@/services/client-wallet-service";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;

  try {
    const instructions = await getActivePaymentInstructions(authorization.context);
    return apiSuccess(instructions, { count: instructions.length });
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Payment instructions could not be loaded.");
  }
}
