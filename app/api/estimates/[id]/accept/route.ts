import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptEstimateWithReservation } from "@/services/order-wallet-service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const acceptSchema = z.object({ clientId: z.string().uuid() });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return apiError("VALIDATION_ERROR", "A valid estimate ID is required.", 400, parsedParams.error.flatten());
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }

  const body = acceptSchema.safeParse(payload);
  if (!body.success) {
    return apiError("VALIDATION_ERROR", "Invalid estimate acceptance request.", 400, body.error.flatten());
  }

  const supabase = await createSupabaseServerClient(request);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return apiError("UNAUTHORIZED", "Authentication is required.", 401);
  }

  try {
    const result = await acceptEstimateWithReservation(supabase, {
      estimateId: parsedParams.data.id,
      clientId: body.data.clientId
    });

    const warnings = result.uncoveredAmountCny > 0
      ? [{
          code: "INSUFFICIENT_WALLET_BALANCE",
          message: "Wallet balance is insufficient; the uncovered amount remains payable at purchase commitment.",
          uncoveredAmountCny: result.uncoveredAmountCny
        }]
      : [];

    return apiSuccess(result, { warnings });
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
