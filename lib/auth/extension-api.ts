import { apiError } from "@/lib/api/response";
import { ADMIN_ROLES, isRoleAllowed } from "@/lib/auth/roles";
import { authorizeApiRequest, type ApiAuthorizationResult } from "@/lib/auth/api";
import { hashExtensionCredentialToken, parseBearerCredential } from "@/lib/auth/extension-credentials";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { UserRole } from "@/lib/domain/types";

export type ExtensionCredentialContext = {
  kind: "credential";
  credentialId: string;
  profileId: string;
  role: Extract<UserRole, "admin" | "super_admin">;
};

export type ExtensionApiAuthorization =
  | { authorized: true; kind: "session"; context: Extract<ApiAuthorizationResult, { authorized: true }> ["context"] }
  | { authorized: true; kind: "credential"; context: ExtensionCredentialContext }
  | { authorized: false; response: ReturnType<typeof apiError> };

export async function authorizeExtensionApiRequest(request: Request): Promise<ExtensionApiAuthorization> {
  const token = parseBearerCredential(request);
  if (!token) {
    const session = await authorizeApiRequest(request, ADMIN_ROLES);
    return session.authorized
      ? { authorized: true, kind: "session", context: session.context }
      : session;
  }

  const supabase = createSupabaseAdminClient();
  const { data: credential, error } = await supabase
    .from("extension_credentials")
    .select("id, profile_id, expires_at, revoked_at")
    .eq("token_hash", hashExtensionCredentialToken(token))
    .maybeSingle();

  if (error || !credential || credential.revoked_at || (credential.expires_at && new Date(credential.expires_at) <= new Date())) {
    return { authorized: false, response: apiError("UNAUTHORIZED", "A valid extension credential is required.", 401) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", credential.profile_id)
    .maybeSingle();
  if (profileError || !profile || profile.status !== "active") {
    return { authorized: false, response: apiError("UNAUTHORIZED", "Extension credential is not authorized for an active admin.", 401) };
  }

  if (!isRoleAllowed(profile.role as UserRole, ADMIN_ROLES)) {
    return { authorized: false, response: apiError("FORBIDDEN", "Extension credential does not have permission to access this resource.", 403) };
  }

  await supabase.from("extension_credentials").update({ last_used_at: new Date().toISOString() }).eq("id", credential.id);
  return { authorized: true, kind: "credential", context: { kind: "credential", credentialId: credential.id, profileId: credential.profile_id, role: profile.role as Extract<UserRole, "admin" | "super_admin"> } };
}
