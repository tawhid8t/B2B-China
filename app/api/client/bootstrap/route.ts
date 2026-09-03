import type { ClientBootstrapData } from "@bridgecart/contracts";

import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";

const CLIENT_MOBILE_ROLE = ["client"] as const;

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_MOBILE_ROLE);
  if (!authorization.authorized) return authorization.response;

  const { supabase, user } = authorization.context;
  const [profileResult, clientResult] = await Promise.all([
    supabase.from("profiles").select("full_name, email").eq("id", user.id).single(),
    supabase.from("clients").select("id, business_name").eq("profile_id", user.id).maybeSingle()
  ]);

  if (profileResult.error) {
    return apiError("INTERNAL_ERROR", "Your client profile could not be loaded.", 500);
  }
  if (clientResult.error) {
    return apiError("INTERNAL_ERROR", "Your client account could not be loaded.", 500);
  }
  if (!clientResult.data) {
    return apiError("FORBIDDEN", "An active client account is required to use the mobile application.", 403);
  }

  const data: ClientBootstrapData = {
    profile: {
      id: user.id,
      email: profileResult.data.email ?? null,
      fullName: profileResult.data.full_name,
      role: "client",
      status: "active"
    },
    client: {
      id: clientResult.data.id,
      businessName: clientResult.data.business_name
    }
  };

  const response = apiSuccess(data);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
