import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const schema = z.object({ orderItemId: z.string().uuid(), reason: z.string().trim().min(1).max(500) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ trackingNumber: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("VALIDATION_ERROR", "Choose one eligible order item and provide a linking reason.", 400, body.error.flatten());
  const { trackingNumber } = await params;
  const { data, error } = await authorization.context.supabase.rpc("link_cainiao_unmatched_parcel", {
    p_tracking_number: trackingNumber, p_order_item_id: body.data.orderItemId, p_reason: body.data.reason,
  });
  if (error) return databaseErrorResponse(error, "CONFLICT", "Cainiao parcel could not be linked.");
  return apiSuccess({ link: Array.isArray(data) ? data[0] ?? null : data });
}
