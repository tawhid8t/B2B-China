import { requireRoleForPath } from "@/lib/auth/session";
import { ClientShell } from "@/components/client/client-shell";
import { getUnreadNotificationCount } from "@/services/notification-service";
import { inter } from "@/app/fonts";

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const context = await requireRoleForPath("/client");
  const { user } = context;
  const fullName = typeof user.user_metadata.full_name === "string" ? user.user_metadata.full_name.trim() : "";
  const unreadNotificationCount = await getUnreadNotificationCount(context).catch(() => null);

  return (
    <div className={inter.variable}>
      <ClientShell
        user={{
          name: fullName || user.email?.split("@")[0] || "Client",
          email: user.email ?? ""
        }}
        unreadNotificationCount={unreadNotificationCount}
      >
        {children}
      </ClientShell>
    </div>
  );
}
