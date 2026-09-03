import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const schema = z.object({ orderItemId: z.string().uuid() });

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;
  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return apiError("VALIDATION_ERROR", "A valid order item is required.", 400, body.error.flatten());
  try {
    const { data, error } = await authorization.context.supabase.rpc("create_client_favorite", { p_order_item_id: body.data.orderItemId });
    if (error) throw error;
    return apiSuccess(data, { created: true }, 201);
  } catch (error) { return databaseErrorResponse(error, "NOT_FOUND", "This order cannot be added to favorites."); }
}
