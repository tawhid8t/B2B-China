import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { createEstimate, EstimateRequestError } from "@/services/estimate-service";
import { createSupabaseEstimateRepository } from "@/services/supabase-estimate-repository";
import { z } from "zod";

const estimateSchema = z.object({
  productId: z.string().uuid(),
  skuId: z.string().uuid(),
  quantity: z.number().int().positive(),
  clientId: z.string().uuid(),
  estimatedUnitWeightKg: z.number().positive().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Invalid estimate request.", 400);
  }

  const body = estimateSchema.safeParse(payload);
  if (!body.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid estimate request.",
      400,
      body.error.flatten(),
    );
  }

  try {
    const estimate = await createEstimate(
      createSupabaseEstimateRepository(authorization.context.supabase),
      body.data,
    );

    return apiSuccess(
      {
        estimateId: estimate.estimateId,
        status: estimate.status,
        validUntil: estimate.validUntil,
        breakdown: {
          unitPriceCny: Number(estimate.breakdown.unitPriceCny),
          quantity: estimate.breakdown.quantity,
          productSubtotalCny: Number(estimate.breakdown.productSubtotalCny),
          domesticDeliveryCny: Number(estimate.breakdown.domesticDeliveryCny),
          exchangeRateCnyToBdt: Number(estimate.breakdown.exchangeRateCnyToBdt),
          productSubtotalBdt: Number(estimate.breakdown.productSubtotalBdt),
          estimatedTotalWeightKg: Number(estimate.breakdown.estimatedTotalWeightKg),
          categoryShippingBdt: Number(estimate.breakdown.categoryShippingBdt),
          chinaToGuangzhouBdt: Number(estimate.breakdown.chinaToGuangzhouBdt),
          profitBdt: Number(estimate.breakdown.profitBdt),
          totalBdt: Number(estimate.breakdown.totalBdt),
        },
      },
      { created: true },
      201,
    );
  } catch (error) {
    if (error instanceof EstimateRequestError) {
      return apiError(
        error.code,
        error.message,
        error.code === "NOT_FOUND" ? 404 : 422,
      );
    }

    return databaseErrorResponse(error);
  }
}
