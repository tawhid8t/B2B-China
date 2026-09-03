/* eslint-disable @next/next/no-img-element -- supplier image hosts are dynamic. */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, StatusBadge } from "@/components/ui";

type PurchaseTask = any;

const stateLabel: Record<string, string> = {
  queued: "Ready for extension",
  cart_added: "Added to cart — waiting for provider details",
  awaiting_provider_details: "Waiting for provider details",
  awaiting_admin_confirmation: "Waiting for admin confirmation",
  needs_review: "Needs review",
};

export function PurchaseTaskCards({ tasks }: { tasks: PurchaseTask[] }) {
  const router = useRouter();
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();

  async function setState(taskId: string, state: "queued" | "needs_review") {
    const reason = state === "needs_review" ? window.prompt("Why does this product need manual review?")?.trim() : undefined;
    if (state === "needs_review" && !reason) return;
    setWorking(taskId);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/purchasing/${taskId}/state`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ state, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Purchase task could not be updated.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Purchase task could not be updated.");
    } finally {
      setWorking(undefined);
    }
  }

  if (!tasks.length) return <EmptyState title="No purchase tasks" description="Confirmed product orders will appear here until their provider purchase is finalized." />;

  return <section className="space-y-5" aria-label="Product purchase queue">
    {error && <Alert variant="danger" title="Purchase task failed">{error}</Alert>}
    {tasks.map((task) => {
      const order = task.product_order;
      const product = order?.product;
      const lines = order?.order_items ?? [];
      const hasMixedSkuStatuses = Boolean(task.hasMixedSkuStatuses);
      const expected = lines.reduce((total: number, line: any) => total + Number(line.cny_price ?? 0) * Number(line.quantity ?? 0), 0);
      return <Card key={task.id} className="overflow-hidden border-border shadow-soft">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface-muted px-4 py-4 sm:px-5">
          <Field label="Order number" value={order?.order_number ?? "—"} />
          <Field label="Client" value={order?.client?.business_name ?? "—"} />
          <Field label="Task state" value={hasMixedSkuStatuses ? "Needs SKU status repair" : stateLabel[task.state] ?? task.state} />
          <span className={`ml-auto rounded-full px-3 py-1 text-xs font-bold ${hasMixedSkuStatuses || task.state === "needs_review" ? "bg-warning/15 text-warning" : task.state === "cart_added" ? "bg-success/15 text-success" : "bg-commerce-100 text-commerce-700"}`}>{hasMixedSkuStatuses ? "Needs review" : stateLabel[task.state] ?? task.state}</span>
        </header>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-card border border-border bg-surface-muted">
                {product?.images?.[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-contain p-1.5" /> : "—"}
              </div>
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Product snapshot</p><h2 className="mt-1 text-base font-semibold sm:text-lg">{product?.title ?? "Product unavailable"}</h2><p className="mt-1 text-sm text-muted">{product?.provider_item_id ?? "Provider item pending"} · {product?.provider ?? "Provider pending"}</p></div>
            </div>
            <div className="flex gap-2">
              {!hasMixedSkuStatuses && task.state !== "needs_review" && task.state !== "cart_added" && <Button size="sm" variant="outline" loading={working === task.id} onClick={() => setState(task.id, "needs_review")}>Needs review</Button>}
              {!hasMixedSkuStatuses && task.state === "needs_review" && <Button size="sm" loading={working === task.id} onClick={() => setState(task.id, "queued")}>Retry purchase</Button>}
            </div>
          </div>
          {task.last_error && <Alert className="mt-5" variant="warning" title="Manual review required">{task.last_error}</Alert>}
          {hasMixedSkuStatuses && <Alert className="mt-5" variant="warning" title="SKU status repair required">This historical product order has a mix of Confirmed and Purchasing SKU lines. It is shown here for visibility, but it cannot be sent to the extension until all SKU lines are queued together.</Alert>}
          {task.state === "cart_added" && <Alert className="mt-5" variant="success" title="Product added to cart">All SKU lines were confirmed in one cart action. Provider price and delivery details are still pending.</Alert>}
          <div className="mt-5 overflow-x-auto rounded-card border border-border"><table className="min-w-[760px] w-full text-left text-sm"><thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">SKU / color / size</th><th>Expected price</th><th>Qty</th><th>Subtotal</th><th>Status</th></tr></thead><tbody className="divide-y divide-border">{lines.map((line: any) => <tr key={line.id}><td className="p-3"><div className="flex items-center gap-3">{line.sku?.image_url && <img src={line.sku.image_url} alt="" className="h-12 w-12 rounded border border-border object-contain p-1" />}<div><p className="font-semibold">{line.sku?.label ?? "Variant unavailable"}</p><p className="mt-1 text-xs text-muted">{Object.entries(line.sku?.attributes ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No attributes"}</p></div></div></td><td>¥{Number(line.cny_price ?? 0).toFixed(2)}</td><td className="font-semibold">{line.quantity}</td><td>¥{(Number(line.cny_price ?? 0) * Number(line.quantity ?? 0)).toFixed(2)}</td><td><StatusBadge status={line.status} /></td></tr>)}</tbody></table></div>
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3"><Field label="Expected product total" value={`CNY ${expected.toFixed(2)}`} /><Field label="SKU lines" value={String(lines.length)} /><Field label="Cart added" value={task.cart_added_at ? new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(task.cart_added_at)) : "Not yet"} /></div>
        </div>
      </Card>;
    })}
  </section>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">{label}</p><p className="mt-1 max-w-[22rem] truncate font-semibold" title={value}>{value}</p></div>;
}
