import { AppShell } from "@/components/app-shell";
import { AdminOrderTable } from "@/components/admin/order-table";
import { requireRoleForPath } from "@/lib/auth/session";
import { loadAdminOrders } from "@/services/admin-operations-service";
export default async function ExceptionsPage() { const context = await requireRoleForPath("/admin/purchasing/exceptions"); const orders = await loadAdminOrders(context, "exception"); return <AppShell title="Purchase exceptions" eyebrow="Needs attention"><AdminOrderTable orders={orders as any[]} /></AppShell>; }
