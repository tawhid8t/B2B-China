import { authorizeApiRequest } from "@/lib/auth/api";
import { apiError } from "@/lib/api/response";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { csvResponse } from "@/lib/csv";
import { getWalletStatement, WALLET_TRANSACTION_TYPES } from "@/services/wallet-statement-service";
import { z } from "zod";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = z.object({ clientId: z.string().uuid(), type: z.enum(WALLET_TRANSACTION_TYPES).optional(), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).safeParse(query);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "A valid client and filters are required.", 400, parsed.error.flatten());
  try {
    const rows = [];
    let page = 1;
    let total = 0;
    do {
      const statement = await getWalletStatement(authorization.context, { ...parsed.data, page, pageSize: 5000 });
      rows.push(...statement.transactions);
      total = statement.meta.total;
      page += 1;
    } while (rows.length < total);
    return csvResponse(`wallet-ledger-${parsed.data.clientId}-${new Date().toISOString().slice(0, 10)}.csv`, ["Transaction ID","Type","CNY","BDT","Rate","Running available CNY","Payment proof","Order","Product","Corrects transaction","Corrected CNY","Remaining correctable CNY","Actor","Reason","Created at"], rows.map((row) => [row.id,row.type,row.amountCny,row.amountBdt,row.cnyToBdtRate,row.runningAvailableBalanceCny,row.paymentProof?.id,row.order?.id,row.order?.productTitle,row.correctsTransactionId,row.cumulativeCorrectedCny,row.correctionRemainingCny,row.actor?.name || row.actor?.id,row.reason,row.createdAt]));
  } catch { return apiError("INTERNAL_ERROR", "Wallet ledger export could not be created.", 500); }
}
