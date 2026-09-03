import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { createExtensionCredentialToken, hashExtensionCredentialToken } from "@/lib/auth/extension-credentials";
import { z } from "zod";

const schema = z.object({ label: z.string().trim().min(1).max(120).optional(), expiresAt: z.string().datetime().optional() });

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const { data, error } = await authorization.context.supabase.from("extension_credentials")
    .select("id,label,created_at,last_used_at,expires_at,revoked_at")
    .order("created_at", { ascending: false });
  if (error) return apiError("INTERNAL_ERROR", "Extension credentials could not be loaded.", 500);
  return apiSuccess((data ?? []).map((credential) => ({
    credentialId: credential.id, label: credential.label, createdAt: credential.created_at,
    lastUsedAt: credential.last_used_at, expiresAt: credential.expires_at,
    status: credential.revoked_at ? "revoked" : "active",
  })));
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  let payload: unknown = {};
  try { payload = await request.json(); } catch { /* Optional body. */ }
  const body = schema.safeParse(payload);
  if (!body.success) return apiError("VALIDATION_ERROR", "Invalid extension credential request.", 400, body.error.flatten());
  if (body.data.expiresAt && new Date(body.data.expiresAt) <= new Date()) return apiError("VALIDATION_ERROR", "Credential expiry must be in the future.", 400);

  const token = createExtensionCredentialToken();
  const { data, error } = await authorization.context.supabase.from("extension_credentials").insert({
    profile_id: authorization.context.user.id, token_hash: hashExtensionCredentialToken(token),
    label: body.data.label ?? null, expires_at: body.data.expiresAt ?? null,
  }).select("id, created_at, expires_at").single();
  if (error || !data) return apiError("INTERNAL_ERROR", "Extension credential could not be created.", 500);
  return apiSuccess({ credentialId: data.id, token, createdAt: data.created_at, expiresAt: data.expires_at });
}
