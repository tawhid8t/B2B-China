import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { recordOrderActualDetails } from "@/services/order-actual-detail-service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const bodySchema = z.object({
  productAmountCny: z.number().nonnegative().optional(),
  localDeliveryCny: z.number().nonnegative().optional(),
  weightKg: z.number().positive().optional(),
  adminNote: z.string().trim().max(4000).optional(),
  reason: z.string().trim().min(1).max(2000),
}).refine(
  (value) => value.productAmountCny !== undefined
    || value.localDeliveryCny !== undefined
    || value.weightKg !== undefined
    || Boolean(value.adminNote),
  "Record at least one actual cost, weight, or client-visible note.",
);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;

  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) return apiError("VALIDATION_ERROR", "Invalid order item ID.", 400);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }
  const parsedBody = bodySchema.safeParse(payload);
  if (!parsedBody.success) {
    return apiError("VALIDATION_ERROR", "Invalid actual-detail update.", 400, parsedBody.error.flatten());
  }

  try {
    const detail = await recordOrderActualDetails(authorization.context, {
      orderItemId: parsedParams.data.id,
      ...parsedBody.data,
    });
    return apiSuccess(detail);
  } catch (error) {
    return databaseErrorResponse(error, "CONFLICT", "Actual order details could not be recorded.");
  }
}
