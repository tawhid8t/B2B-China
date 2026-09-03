import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createWalletAdjustment } from "@/services/wallet-statement-service";
import { z } from "zod";

const schema = z.object({ amountCny: z.coerce.number().min(-99_999_999.99).max(99_999_999.99).refine((value) => value !== 0), cnyToBdtRate: z.coerce.number().positive().max(99_999.9999), reason: z.string().trim().min(1).max(1000) });
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES); if (!authorization.authorized) return authorization.response;
  let json: unknown; try { json = await request.json(); } catch { return apiError("VALIDATION_ERROR", "Adjustment payload is invalid.", 400); }
  const body = schema.safeParse(json); if (!body.success) return apiError("VALIDATION_ERROR", "A non-zero amount, positive rate, and reason are required.", 400, body.error.flatten());
  const { id } = await params;
  try { return apiSuccess(await createWalletAdjustment(authorization.context, { clientId: id, ...body.data }), {}, 201); }
  catch (error) { return databaseErrorResponse(error, "INTERNAL_ERROR", "Wallet adjustment could not be posted."); }
}
