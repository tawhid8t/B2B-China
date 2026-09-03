import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const paramsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ADMIN_ROLES);
  if (!authorization.authorized) return authorization.response;
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return apiError("VALIDATION_ERROR", "Invalid extension credential ID.", 400);
  const { data, error } = await authorization.context.supabase.from("extension_credentials")
    .update({ revoked_at: new Date().toISOString() }).eq("id", parsed.data.id).is("revoked_at", null).select("id").maybeSingle();
  if (error) return apiError("INTERNAL_ERROR", "Extension credential could not be revoked.", 500);
  if (!data) return apiError("NOT_FOUND", "Active extension credential not found.", 404);
  return apiSuccess({ credentialId: data.id, revoked: true });
}
