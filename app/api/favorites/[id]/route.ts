import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const idSchema = z.string().uuid();
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(_request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return apiError("VALIDATION_ERROR", "A valid favorite ID is required.", 400);
  try {
    const { data, error } = await authorization.context.supabase.rpc("archive_client_favorite", { p_favorite_id: id.data });
    if (error) throw error;
    if (!data) return apiError("NOT_FOUND", "Favorite not found.", 404);
    return apiSuccess({ archived: true });
  } catch (error) { return databaseErrorResponse(error, "NOT_FOUND", "Favorite could not be archived."); }
}
