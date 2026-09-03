import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Alert, EmptyState, StatusBadge } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";
import { loadAdminDashboard } from "@/services/admin-operations-service";

export default async function AdminPage() {
  const context = await requireRoleForPath("/admin");
  const dashboard = await loadAdminDashboard(context);
  const cards = [
    ["Pending review", dashboard.counts.pending, "/admin/orders/review"],
    ["Ready to purchase", dashboard.counts.queued, "/admin/purchasing"],
    ["Purchased", dashboard.counts.purchased, "/admin/purchasing/purchased"],
    ["Exceptions", dashboard.counts.exceptions, "/admin/purchasing/exceptions"],
  ] as const;
  const reconciliationIssues = Object.values(dashboard.reconciliation).reduce((sum, value) => sum + value, 0);

  return <AppShell title="Operations dashboard" eyebrow="Admin workspace"><div className="space-y-6">
    {reconciliationIssues > 0 && <Alert variant="danger" title="Financial reconciliation needs attention">{reconciliationIssues} persisted inconsistency{reconciliationIssues === 1 ? "" : "ies"} detected. Review wallet and payment records before further corrections.</Alert>}
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{cards.map(([label, count, href]) => <SummaryCard key={label} label={label} value={String(count)} href={href} />)}</section>
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-commerce-700">Financial operations</p><h2 className="mt-1 text-xl font-semibold">Wallet and payment summary</h2></div><Link href="/admin/notifications" className="text-sm font-semibold text-commerce-700">Open notifications</Link></div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Pending proofs" value={String(dashboard.financial.pendingPaymentProofs)} detail={`${dashboard.financial.needsReviewPaymentProofs} need review`} href="/admin/payments" />
        <SummaryCard label="Client balances" value={`CNY ${dashboard.financial.totalAvailableCny.toFixed(2)}`} detail={`${dashboard.financial.clientsWithBalance} of ${dashboard.financial.clientCount} clients funded`} href="/admin/wallet" />
        <SummaryCard label="Reserved funds" value={`CNY ${dashboard.financial.totalReservedCny.toFixed(2)}`} detail={`CNY ${dashboard.financial.totalClientFundsCny.toFixed(2)} total funds`} href="/admin/wallet" />
        <SummaryCard label="Uncovered orders" value={`CNY ${dashboard.financial.uncoveredOrderCny.toFixed(2)}`} detail={`${dashboard.financial.uncoveredOrderCount} active orders`} href="/admin/orders" />
      </div>
    </section>
    <section className="grid gap-6 xl:grid-cols-2"><RecentOrders orders={dashboard.recentOrders as any[]} /><section className="rounded-card border border-border bg-surface p-5"><h2 className="text-lg font-semibold">Recent purchases</h2>{dashboard.recentPurchases.length ? <div className="mt-4 space-y-3">{(dashboard.recentPurchases as any[]).map((purchase) => <div className="rounded-control bg-surface-muted px-4 py-3" key={purchase.id}><p className="font-semibold">{purchase.order_item?.product?.title ?? "Product"}</p><p className="mt-1 text-sm text-muted">{purchase.provider} · {purchase.provider_order_id ?? "Provider reference pending"} · CNY {Number(purchase.paid_amount_cny ?? 0).toFixed(2)}</p></div>)}</div> : <div className="mt-4"><EmptyState title="No data yet" description="Provider purchases will appear after a valid sync." /></div>}</section></section>
  </div></AppShell>;
}

function SummaryCard({ label, value, detail, href }: { label: string; value: string; detail?: string; href: string }) {
  return <Link href={href} className="rounded-card border border-border bg-surface p-5 shadow-sm hover:border-commerce-300"><p className="text-sm font-semibold text-muted">{label}</p><p className="mt-3 text-2xl font-semibold text-foreground">{value}</p>{detail && <p className="mt-2 text-xs text-muted">{detail}</p>}</Link>;
}

function RecentOrders({ orders }: { orders: any[] }) {
  return <section className="rounded-card border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Recent orders</h2><Link href="/admin/orders" className="text-sm font-semibold text-commerce-700">View all</Link></div>{orders.length ? <div className="mt-4 space-y-3">{orders.map((order) => <Link href={`/admin/orders/${order.id}`} key={order.id} className="flex items-center justify-between rounded-control bg-surface-muted px-4 py-3"><div><p className="font-semibold">{order.product?.title ?? "Product"}</p><p className="text-sm text-muted">{order.client?.business_name ?? "—"}</p></div><StatusBadge status={order.status} /></Link>)}</div> : <div className="mt-4"><EmptyState title="No data yet" description="Orders will appear here when clients confirm products." /></div>}</section>;
}
