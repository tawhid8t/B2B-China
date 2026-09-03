import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { reviewPaymentProof } from "@/services/admin-payment-service";
import { z } from "zod";

const schema = z.object({
  verifiedAmountBdt: z.coerce.number().positive().max(99_999_999.99),
  cnyToBdtRate: z.coerce.number().positive().max(99_999.9999),
  reason: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  let json: unknown;
  try { json = await request.json(); } catch { return apiError("VALIDATION_ERROR", "Approval payload is invalid.", 400); }
  const body = schema.safeParse(json);
  if (!body.success) return apiError("VALIDATION_ERROR", "Verified amount and exchange rate are required.", 400, body.error.flatten());
  const { id } = await params;
  try {
    return apiSuccess(await reviewPaymentProof(authorization.context, {
      paymentProofId: id, action: "approve", ...body.data,
    }));
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Payment proof could not be approved.");
  }
}
