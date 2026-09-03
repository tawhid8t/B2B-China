import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Alert, Card, PriceDisplay, StatusBadge } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";
import type { OrderStatus } from "@/lib/domain/types";
import { loadAdminOrder } from "@/services/admin-operations-service";

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const context = await requireRoleForPath(`/admin/orders/${id}`);
  const order = await loadAdminOrder(context, id);
  if (!order) notFound();

  const committed = Boolean(order.wallet_committed_at);
  const covered = Number(
    committed ? order.wallet_committed_cny : order.wallet_reserved_cny,
  );
  const uncovered = Number(order.wallet_uncovered_cny ?? 0);
  return (
    <AppShell title="Order review" eyebrow="Wallet coverage and purchase audit">
      <div className="space-y-5">
        {uncovered > 0 && (
          <Alert variant="warning" title="Pending supplier payment">
            CNY {uncovered.toFixed(2)} is not covered by the client wallet. The
            order may continue, but this amount remains payable.
          </Alert>
        )}
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-muted">
                Order item
              </p>
              <p className="mt-1 font-mono text-sm">{order.id}</p>
              <h2 className="mt-4 text-xl font-semibold">
                {order.product?.title ?? "Product unavailable"}
              </h2>
              <p className="mt-1 text-sm text-muted">
                {order.client?.business_name ?? "Client unavailable"} ·{" "}
                {order.sku?.label ?? "Variant unavailable"} · quantity{" "}
                {order.quantity}
              </p>
            </div>
            <StatusBadge status={order.status as OrderStatus} />
          </div>
        </Card>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Required supplier cost"
            value={Number(
              order.wallet_required_cny ??
                Number(order.wallet_reserved_cny) + uncovered,
            )}
          />
          <Metric
            label={committed ? "Wallet debited" : "Wallet reserved"}
            value={covered}
          />
          <Metric label="Uncovered" value={uncovered} warning={uncovered > 0} />
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">
              Applied rate
            </p>
            <p className="mt-2 text-lg font-semibold">
              {order.wallet_rate_cny_to_bdt
                ? `${Number(order.wallet_rate_cny_to_bdt).toFixed(4)} BDT/CNY`
                : "Historical rate unavailable"}
            </p>
            <p className="mt-1 text-xs text-muted">
              {committed
                ? "Purchase commitment rate"
                : "Confirmation snapshot rate"}
            </p>
          </Card>
        </div>
        <Card className="p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Financial audit</h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
            <Detail
              label="Reservation state"
              value={
                committed
                  ? "Released and committed"
                  : covered > 0
                    ? "Active reservation"
                    : "No wallet funds reserved"
              }
            />
            <Detail
              label="Purchase committed at"
              value={
                order.wallet_committed_at
                  ? formatDate(order.wallet_committed_at)
                  : "Not committed"
              }
            />
            <Detail
              label="Committed by"
              value={order.wallet_committed_by ?? "Not committed"}
            />
            <Detail
              label="Rate adjustment reason"
              value={order.wallet_rate_adjustment_reason ?? "No adjusted rate"}
            />
            <Detail
              label="Estimated total"
              value={
                order.estimated_total_bdt
                  ? `BDT ${Number(order.estimated_total_bdt).toFixed(2)}`
                  : "Unavailable"
              }
            />
            <Detail
              label="Actual total"
              value={
                order.actual_total_bdt
                  ? `BDT ${Number(order.actual_total_bdt).toFixed(2)}`
                  : "Not committed"
              }
            />
          </dl>
        </Card>
      </div>
    </AppShell>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: number;
  warning?: boolean;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </p>
      <PriceDisplay
        className={warning ? "mt-2 text-warning" : "mt-2"}
        value={value}
        currency="CNY"
        showCode
      />
    </Card>
  );
}
function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="mt-1 break-words font-semibold">{value}</dd>
    </div>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-BD", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
