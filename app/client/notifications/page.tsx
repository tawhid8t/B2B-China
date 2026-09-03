import { NotificationInbox } from "@/components/notifications/notification-inbox";
import { ErrorState, PageHeader } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";
import { getNotificationInbox } from "@/services/notification-service";

export default async function ClientNotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const context = await requireRoleForPath("/client/notifications");
  const page = positivePage((await searchParams).page);
  return <><PageHeader eyebrow="Updates" title="Notifications" description="Payment, wallet, and order-funding updates addressed only to your account." /><section className="mt-7"><Inbox context={context} page={page} /></section></>;
}

async function Inbox({ context, page }: { context: Awaited<ReturnType<typeof requireRoleForPath>>; page: number }) {
  try { return <NotificationInbox inbox={await getNotificationInbox(context, page)} workspace="client" />; }
  catch { return <ErrorState title="Notifications unavailable" description="Refresh the page or try again later." />; }
}

function positivePage(value?: string) { const page = Number(value ?? "1"); return Number.isInteger(page) && page > 0 ? page : 1; }
