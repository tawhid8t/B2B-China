import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { markNotificationRead, NotificationNotFoundError } from "@/services/notification-service";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authorization = await authorizeApiRequest(request, ["client", "admin", "super_admin"]);
  if (!authorization.authorized) return authorization.response;

  try {
    return apiSuccess(await markNotificationRead(authorization.context, (await params).id));
  } catch (error) {
    if (error instanceof NotificationNotFoundError) return apiError("NOT_FOUND", "Notification not found.", 404);
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Notification could not be marked as read.");
  }
}
