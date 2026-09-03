import { AppShell } from "@/components/app-shell";
import { AdminOrderTable } from "@/components/admin/order-table";
import { requireRoleForPath } from "@/lib/auth/session";
import { loadAdminOrders } from "@/services/admin-operations-service";
export default async function AdminOrdersPage() { const context = await requireRoleForPath("/admin/orders"); const orders = await loadAdminOrders(context); return <AppShell title="All orders" eyebrow="Orders"><AdminOrderTable orders={orders as any[]} /></AppShell>; }
