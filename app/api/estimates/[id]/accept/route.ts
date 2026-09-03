import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import {
  acceptEstimate,
  EstimateLifecycleError,
} from "@/services/estimate-lifecycle-service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const acceptSchema = z.object({ clientId: z.string().uuid() });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest(
    request,
    CLIENT_OPERATION_ROLES,
  );
  if (!authorization.authorized) return authorization.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return apiError(
      "VALIDATION_ERROR",
      "A valid estimate ID is required.",
      400,
      parsedParams.error.flatten(),
    );
  }

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

  const body = acceptSchema.safeParse(payload);
  if (!body.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid estimate acceptance request.",
      400,
      body.error.flatten(),
    );
  }

  try {
    const result = await acceptEstimate(authorization.context, {
      estimateId: parsedParams.data.id,
      clientId: body.data.clientId,
    });

    const warnings =
      result.uncoveredAmountCny > 0
        ? [
            {
              code: "INSUFFICIENT_WALLET_BALANCE",
              message:
                "Wallet balance is insufficient; the uncovered amount remains payable at purchase commitment.",
              uncoveredAmountCny: result.uncoveredAmountCny,
            },
          ]
        : [];

    return apiSuccess(
      {
        orderItemId: result.orderItemId,
        groupId: result.groupId,
        groupCode: result.groupCode,
        status: result.status,
        walletReservationStatus: result.walletReservationStatus,
        requiredAmountCny: result.requiredAmountCny,
        reservedAmountCny: result.reservedAmountCny,
        uncoveredAmountCny: result.uncoveredAmountCny,
        walletBalanceCny: result.walletBalanceCny,
      },
      { warnings },
    );
  } catch (error) {
    if (error instanceof EstimateLifecycleError) {
      return apiError(error.code, error.message, error.status, error.details);
    }
    return apiError("INTERNAL_ERROR", "Estimate acceptance failed.", 500);
  }
}
