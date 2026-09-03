import { apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createPaymentProofSignedUrl } from "@/services/admin-payment-service";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const { id } = await params;
  try { return apiSuccess(await createPaymentProofSignedUrl(authorization.context, id)); }
  catch (error) { return databaseErrorResponse(error, "INTERNAL_ERROR", "Proof preview could not be created."); }
}
