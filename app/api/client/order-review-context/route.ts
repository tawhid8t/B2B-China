import { apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { getClientOrderReviewContext } from "@/services/client-wallet-service";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ["client"]);
  if (!authorization.authorized) return authorization.response;

  try {
    const context = await getClientOrderReviewContext(authorization.context);
    return apiSuccess(context);
  } catch (error) {
    return databaseErrorResponse(
      error,
      "INTERNAL_ERROR",
      "Order review context could not be loaded.",
    );
  }
}
