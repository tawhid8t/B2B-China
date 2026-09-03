import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { findShippingTariffByItem } from "@/lib/shipping-tariffs";
import {
  acceptEstimate,
  EstimateLifecycleError,
} from "@/services/estimate-lifecycle-service";
import {
  confirmMultiSkuOrder,
  OrderConfirmationError,
  orderConfirmationErrorResponse,
} from "@/services/order-confirmation-service";
import { z } from "zod";

const legacyConfirmSchema = z.object({
  estimateId: z.string().uuid(),
  clientId: z.string().uuid(),
  walletMode: z.enum(["reserve", "skip"]).default("reserve"),
});

const directConfirmSchema = z.object({
  clientId: z.string().uuid().optional(),
  productId: z.string().uuid(),
  estimatedUnitWeightKg: z.number().positive(),
  internationalShippingCategory: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(8).max(200),
  lines: z
    .array(
      z.object({
        skuId: z.string().uuid(),
        quantity: z.number().int().positive(),
      }),
    )
    .min(1)
    .max(500),
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(
    request,
    CLIENT_OPERATION_ROLES,
  );
  if (!authorization.authorized) return authorization.response;

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError(
      "VALIDATION_ERROR",
      "A JSON request body is required.",
      400,
    );
  }

  const directBody = directConfirmSchema.safeParse(payload);
  if (directBody.success) {
    const tariff = findShippingTariffByItem(
      directBody.data.internationalShippingCategory,
    );
    if (!tariff) {
      return apiError(
        "VALIDATION_ERROR",
        "Select a valid Bangladesh international shipping tariff before confirming.",
        400,
      );
    }

    try {
      const result = await confirmMultiSkuOrder(authorization.context, {
        ...directBody.data,
        tariff,
      });

      const warnings = result.pendingPayment
        ? [
            {
              code: "INSUFFICIENT_WALLET_BALANCE",
              message: `Order confirmed. CNY ${result.reservedAmountCny.toFixed(2)} is reserved and CNY ${result.uncoveredAmountCny.toFixed(2)} remains payable.`,
              walletBalanceCny: result.walletBalanceCny,
              uncoveredAmountCny: result.uncoveredAmountCny,
            },
          ]
        : [];

      return apiSuccess(
        {
          clientId: result.clientId,
          productOrderId: result.productOrderId,
          orderNumber: result.orderNumber,
          submittedAt: result.submittedAt,
          groupId: result.groupId,
          groupCode: result.groupCode,
          status: result.status,
          productBaseCostCny: result.productBaseCostCny,
          grandEstimatedTotalBdt: result.grandEstimatedTotalBdt,
          walletBalanceCny: result.walletBalanceCny,
          pendingPayment: result.pendingPayment,
          requiredAmountCny: result.requiredAmountCny,
          reservedAmountCny: result.reservedAmountCny,
          uncoveredAmountCny: result.uncoveredAmountCny,
          appliedRate: result.appliedRate,
          orderItems: result.orderItems,
        },
        { warnings },
      );
    } catch (error) {
      if (error instanceof OrderConfirmationError) {
        return orderConfirmationErrorResponse(error);
      }
      return apiError("INTERNAL_ERROR", "Order confirmation failed.", 500);
    }
  }

  const body = legacyConfirmSchema.safeParse(payload);
  if (!body.success) {
    return apiError("VALIDATION_ERROR", "Invalid confirmation request.", 400, {
      direct: directBody.error?.flatten(),
      legacy: body.error.flatten(),
    });
  }

  try {
    const result = await acceptEstimate(authorization.context, body.data);

    const response = apiSuccess({
      orderItemId: result.orderItemId,
      groupId: result.groupId,
      groupCode: result.groupCode,
      status: result.status,
      walletReservationStatus: result.walletReservationStatus,
      requiredAmountCny: result.requiredAmountCny,
      reservedAmountCny: result.reservedAmountCny,
      uncoveredAmountCny: result.uncoveredAmountCny,
      walletBalanceCny: result.walletBalanceCny,
    });
    response.headers.set("Deprecation", "true");
    response.headers.set(
      "Link",
      `</api/estimates/${body.data.estimateId}/accept>; rel="successor-version"`,
    );
    return response;
  } catch (error) {
    if (error instanceof EstimateLifecycleError) {
      return apiError(error.code, error.message, error.status, error.details);
    }
    return apiError("INTERNAL_ERROR", "Estimate acceptance failed.", 500);
  }
}
