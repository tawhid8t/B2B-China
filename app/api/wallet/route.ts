import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { getWalletStatement, WALLET_TRANSACTION_TYPES } from "@/services/wallet-statement-service";
import { z } from "zod";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ["client", "admin", "super_admin"]);
  if (!authorization.authorized) return authorization.response;
  const query = new URL(request.url).searchParams;
  const parsed = z.object({
    clientId: z.string().uuid().optional(), page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(30),
    type: z.enum(WALLET_TRANSACTION_TYPES).optional(), from: date, to: date,
  }).safeParse(Object.fromEntries(query));
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Wallet statement filters are invalid.", 400, parsed.error.flatten());
  try {
    const statement = await getWalletStatement(authorization.context, parsed.data);
    return apiSuccess({ clientId: statement.clientId, totals: statement.totals, transactions: statement.transactions }, statement.meta);
  } catch (error) { return databaseErrorResponse(error, "INTERNAL_ERROR", "Wallet statement could not be loaded."); }
}
