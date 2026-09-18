import { apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const { data, error } = await authorization.context.supabase.rpc("get_cainiao_unmatched_link_candidates");
  if (error) return databaseErrorResponse(error, "INTERNAL_ERROR", "Link candidates could not be loaded.");
  return apiSuccess({ candidates: data ?? [] });
}
