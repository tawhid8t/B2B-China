import { apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { RECEIVING_ROLES } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ trackingNumber: string }> },
) {
  const authorization = await authorizeApiRequest(request, RECEIVING_ROLES);
  if (!authorization.authorized) return authorization.response;

  const { trackingNumber } = await params;
  const { data, error } = await createSupabaseAdminClient().rpc("collect_cainiao_parcel_for_profile", {
    p_profile_id: authorization.context.user.id,
    p_tracking_number: trackingNumber,
  });
  if (error) return databaseErrorResponse(error, "CONFLICT", "Cainiao parcel could not be marked collected.");

  const parcel = Array.isArray(data) ? data[0] : data;
  return apiSuccess({
    parcelId: parcel?.parcel_id,
    trackingNumber: parcel?.tracking_number,
    status: parcel?.parcel_status,
    collectedAt: parcel?.collected_at,
  });
}
