import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { getClientPaymentHistory } from "@/services/client-wallet-service";
import { z } from "zod";

const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
});

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ["client"]);
  if (!authorization.authorized) return authorization.response;

  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return apiError("VALIDATION_ERROR", "Invalid payment-history page.", 400, query.error.flatten());

  try {
    const history = await getClientPaymentHistory(authorization.context, query.data.page);
    return apiSuccess(history.proofs, {
      page: history.page,
      pageSize: history.pageSize,
      total: history.total,
    });
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Payment history could not be loaded.");
  }
}
