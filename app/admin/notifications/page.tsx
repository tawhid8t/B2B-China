import { AppShell } from "@/components/app-shell";
import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { ErrorState } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";
import { getNotificationInbox } from "@/services/notification-service";

export default async function AdminNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requireRoleForPath("/admin/notifications");
  const value = Number((await searchParams).page ?? "1");
  const page = Number.isInteger(value) && value > 0 ? value : 1;
  let content;
  try { content = <NotificationInbox inbox={await getNotificationInbox(context, page)} workspace="admin" />; }
  catch { content = <ErrorState title="Notifications unavailable" description="Refresh the page or try again later." />; }
  return <AppShell title="Notifications" eyebrow="Admin inbox">{content}</AppShell>;
}
