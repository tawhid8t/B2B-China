import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { getClientProductStatementDetail } from "@/services/client-product-statement-detail-service";
import { z } from "zod";

const paramsSchema = z.object({ productLinkId: z.string().uuid() });

export async function GET(
  request: Request,
  { params }: { params: Promise<{ productLinkId: string }> },
) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;

  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid product statement identifier.", 400);

  try {
    const detail = await getClientProductStatementDetail(authorization.context, parsed.data.productLinkId);
    if (!detail) return apiError("NOT_FOUND", "Product statement was not found.", 404);
    return apiSuccess(detail);
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Product statement detail could not be loaded.");
  }
}
