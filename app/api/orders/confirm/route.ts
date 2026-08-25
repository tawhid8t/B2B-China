import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { acceptEstimateWithReservation } from "@/services/order-wallet-service";
import { NextResponse } from "next/server";
import { z } from "zod";

const confirmSchema = z.object({
  estimateId: z.string().uuid(),
  clientId: z.string().uuid(),
  walletMode: z.enum(["reserve", "skip"]).default("reserve")
});

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }

  const body = confirmSchema.safeParse(payload);
  if (!body.success) {
    return apiError("VALIDATION_ERROR", "Invalid confirmation request.", 400, body.error.flatten());
  }

  const supabase = await createSupabaseServerClient(request);
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return apiError("UNAUTHORIZED", "Authentication is required.", 401);
  }

  try {
    const result = await acceptEstimateWithReservation(supabase, body.data);

    return NextResponse.json(
      {
        orderItemId: result.orderItemId,
        groupCode: result.groupCode,
        status: result.status,
        walletReservationStatus: result.walletReservationStatus
      },
      {
        headers: {
          Deprecation: "true",
          Link: `</api/estimates/${body.data.estimateId}/accept>; rel="successor-version"`
        }
      }
    );
  } catch (error) {
    return databaseErrorResponse(error);
  }
}
