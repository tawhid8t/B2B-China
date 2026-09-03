import type { AuthorizationContext } from "@/lib/auth/session";

export const NOTIFICATION_PAGE_SIZE = 20;

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  eventType: string;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
};

export async function getUnreadNotificationCount(context: AuthorizationContext) {
  const { count, error } = await context.supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null);

  if (error) throw error;
  return count ?? 0;
}

export async function getNotificationInbox(context: AuthorizationContext, page = 1) {
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const from = (safePage - 1) * NOTIFICATION_PAGE_SIZE;
  const to = from + NOTIFICATION_PAGE_SIZE - 1;

  const [notifications, unread] = await Promise.all([
    context.supabase
      .from("notifications")
      .select("id,title,body,event_type,entity_type,entity_id,read_at,created_at", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    context.supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null),
  ]);

  if (notifications.error) throw notifications.error;
  if (unread.error) throw unread.error;

  return {
    notifications: (notifications.data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      eventType: row.event_type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      readAt: row.read_at,
      createdAt: row.created_at,
    })) satisfies AppNotification[],
    page: safePage,
    pageSize: NOTIFICATION_PAGE_SIZE,
    total: notifications.count ?? 0,
    unread: unread.count ?? 0,
  };
}

export async function markNotificationRead(context: AuthorizationContext, notificationId: string) {
  const { data, error } = await context.supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId)
    .is("read_at", null)
    .select("id,read_at")
    .maybeSingle();

  if (error) throw error;
  if (data) return { id: data.id, readAt: data.read_at };

  const { data: existing, error: existingError } = await context.supabase
    .from("notifications")
    .select("id,read_at")
    .eq("id", notificationId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (!existing) throw new NotificationNotFoundError();
  return { id: existing.id, readAt: existing.read_at };
}

export class NotificationNotFoundError extends Error {}
