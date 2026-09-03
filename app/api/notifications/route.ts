import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { getNotificationInbox } from "@/services/notification-service";

const querySchema = z.object({ page: z.coerce.number().int().min(1).default(1) });

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ["client", "admin", "super_admin"]);
  if (!authorization.authorized) return authorization.response;
  const query = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!query.success) return apiError("VALIDATION_ERROR", "Invalid notification page.", 400, query.error.flatten());

  try {
    const inbox = await getNotificationInbox(authorization.context, query.data.page);
    return apiSuccess(inbox.notifications, {
      page: inbox.page,
      pageSize: inbox.pageSize,
      total: inbox.total,
      unread: inbox.unread,
    });
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Notifications could not be loaded.");
  }
}
