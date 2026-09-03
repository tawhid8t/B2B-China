import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { getClientOrderCards } from "@/services/client-order-cards-service";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;
  try {
    const result = await getClientOrderCards(authorization.context);
    return apiSuccess(result.orders, { count: result.orders.length });
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Your orders could not be loaded.");
  }
}
