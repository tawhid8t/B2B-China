import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeExtensionApiRequest } from "@/lib/auth/extension-api";
import {
  extensionCorsPreflight,
  extensionCorsResponse,
} from "@/lib/api/extension-cors";
import {
  syncProviderOrderAndCommitWallet,
  syncProviderOrderAndCommitWalletForExtensionCredential,
} from "@/services/order-wallet-service";
import { z } from "zod";

const syncSchema = z.object({
  orderItemId: z.string().uuid(),
  provider: z.literal("alibaba1688"),
  providerOrderId: z.string().trim().min(1),
  paidAmountCny: z.number().positive(),
  sellerTrackingNumber: z.string().trim().min(1).optional(),
  providerStatus: z.string().trim().min(1),
  rawPayload: z.record(z.unknown()).optional(),
  cnyToBdtRate: z.number().positive().optional(),
  rateAdjustmentReason: z.string().trim().min(3).max(2000).optional(),
  purchaseBatchId: z.string().uuid().optional(),
  providerSkuId: z.string().trim().min(1).optional(),
  providerItemId: z.string().trim().min(1).optional(),
  sellerName: z.string().trim().min(1).optional(),
  sellerId: z.string().trim().min(1).optional(),
  quantityPurchased: z.number().int().positive().optional(),
  actualUnitPriceCny: z.number().nonnegative().optional(),
  actualProductSubtotalCny: z.number().nonnegative().optional(),
  actualDomesticDeliveryCny: z.number().nonnegative().optional(),
  actualDiscountCny: z.number().nonnegative().optional(),
  purchasedAt: z.string().datetime().optional(),
});

export async function POST(request: Request) {
  const authorization = await authorizeExtensionApiRequest(request);
  if (!authorization.authorized)
    return extensionCorsResponse(request, authorization.response);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return extensionCorsResponse(
      request,
      apiError("VALIDATION_ERROR", "A JSON request body is required.", 400),
    );
  }

  const body = syncSchema.safeParse(payload);
  if (!body.success) {
    return extensionCorsResponse(
      request,
      apiError(
        "VALIDATION_ERROR",
        "Invalid provider sync payload.",
        400,
        body.error.flatten(),
      ),
    );
  }

  try {
    const result =
      authorization.kind === "credential"
        ? await syncProviderOrderAndCommitWalletForExtensionCredential(
            authorization.context,
            body.data,
          )
        : await syncProviderOrderAndCommitWallet(
            authorization.context,
            body.data,
          );
    return extensionCorsResponse(request, apiSuccess(result));
  } catch (error) {
    return extensionCorsResponse(
      request,
      databaseErrorResponse(
        error,
        "PROVIDER_SYNC_FAILED",
        "Provider order sync could not be completed.",
      ),
    );
  }
}

export function OPTIONS(request: Request) {
  return extensionCorsPreflight(request);
}
