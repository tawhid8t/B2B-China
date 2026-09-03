import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { cancelClientPaymentProof } from "@/services/client-wallet-service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ["client"]);
  if (!authorization.authorized) return authorization.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "A valid payment proof ID is required.", 400);

  try {
    return apiSuccess(await cancelClientPaymentProof(authorization.context, parsed.data.id));
  } catch (error) {
    return databaseErrorResponse(error, "CONFLICT", "Payment proof could not be cancelled.");
  }
}
