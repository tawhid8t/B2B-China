import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import {
  EstimateLifecycleError,
  rejectEstimate,
} from "@/services/estimate-lifecycle-service";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });
const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
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
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }

  const body = rejectSchema.safeParse(payload);
  if (!body.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Invalid estimate rejection request.",
      400,
      body.error.flatten(),
    );
  }

  try {
    return apiSuccess(await rejectEstimate(authorization.context, {
      estimateId: parsedParams.data.id,
      reason: body.data.reason,
    }));
  } catch (error) {
    if (error instanceof EstimateLifecycleError) {
      return apiError(error.code, error.message, error.status, error.details);
    }
    return apiError("INTERNAL_ERROR", "Estimate rejection failed.", 500);
  }
}
