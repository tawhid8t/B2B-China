import { AppShell } from "@/components/app-shell";
import { ProductOrderReviewCards } from "@/components/admin/product-order-review-cards";
import { requireRoleForPath } from "@/lib/auth/session";
import { loadAdminPendingProductOrders } from "@/services/admin-operations-service";
export default async function ReviewPage() { const context = await requireRoleForPath("/admin/orders/review"); const orders = await loadAdminPendingProductOrders(context); return <AppShell title="Pending orders" eyebrow="Orders awaiting confirmation"><ProductOrderReviewCards orders={orders as any[]} /></AppShell>; }
