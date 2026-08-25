import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { syncProviderOrderAndCommitWallet } from "@/services/order-wallet-service";
import { z } from "zod";

const syncSchema = z.object({
  orderItemId: z.string().uuid(),
  provider: z.string().trim().min(1).default("unknown"),
  providerOrderId: z.string().trim().min(1),
  paidAmountCny: z.number().positive(),
  sellerTrackingNumber: z.string().trim().min(1).optional(),
  providerStatus: z.string().trim().min(1),
  rawPayload: z.record(z.unknown()).optional(),
  cnyToBdtRate: z.number().positive().optional()
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }

  const body = syncSchema.safeParse(payload);
  if (!body.success) {
    return apiError("VALIDATION_ERROR", "Invalid provider sync payload.", 400, body.error.flatten());
  }

  const supabase = await createSupabaseServerClient(request);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return apiError("UNAUTHORIZED", "Authentication is required.", 401);
  }

  try {
    return apiSuccess(await syncProviderOrderAndCommitWallet(supabase, body.data));
  } catch (error) {
    return databaseErrorResponse(error, "PROVIDER_SYNC_FAILED", "Provider order sync could not be completed.");
  }
}
