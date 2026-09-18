import { AppShell } from "@/components/app-shell";
import { PurchasedOrderCards } from "@/components/admin/purchased-order-cards";
import { EmptyState } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";
import { loadPurchasedOrders } from "@/services/admin-operations-service";
export default async function PurchasedPage() { const context = await requireRoleForPath("/admin/purchasing/purchased"); const rows = await loadPurchasedOrders(context) as any[]; return <AppShell title="Purchased" eyebrow="Actual provider purchases">{rows.length ? <PurchasedOrderCards rows={rows} /> : <EmptyState title="No data yet" description="Actual provider purchases will appear after purchase sync." />}</AppShell>; }
