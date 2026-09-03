/* eslint-disable @next/next/no-img-element -- supplier image hosts are dynamic. */
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card, EmptyState, StatusBadge } from "@/components/ui";

type ProductOrder = any;

export function ProductOrderReviewCards({ orders }: { orders: ProductOrder[] }) {
  const router = useRouter();
  const [working, setWorking] = useState<string>();
  const [error, setError] = useState<string>();

  async function confirm(orderId: string) {
    setWorking(orderId);
    setError(undefined);
    try {
      const response = await fetch(`/api/admin/product-orders/${orderId}/confirm`, {
        method: "POST",
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message ?? "Order could not be confirmed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Order could not be confirmed.");
    } finally {
      setWorking(undefined);
    }
  }

  if (!orders.length) {
    return <EmptyState title="No pending orders" description="Orders awaiting admin confirmation will appear here." />;
  }

  return <section className="space-y-5" aria-label="Pending product orders">
    {error && <Alert variant="danger" title="Confirmation failed">{error}</Alert>}
    {orders.map((order) => {
      const lines = order.order_items ?? [];
      const product = order.product;
      const productTotal = lines.reduce((total: number, line: any) => total + Number(line.cny_price ?? 0) * Number(line.quantity ?? 0), 0);
      const domesticTotal = lines.reduce((total: number, line: any) => total + Number(line.domestic_delivery_cny ?? 0), 0);
      const uncovered = lines.reduce((total: number, line: any) => total + Number(line.wallet_uncovered_cny ?? 0), 0);
      return <Card key={order.id} className="overflow-hidden border-border shadow-soft">
        <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface-muted px-4 py-4 sm:px-5">
          <Field label="Order number" value={order.order_number} />
          <Field label="Client" value={order.client?.business_name ?? "—"} />
          <Field label="Order date" value={new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))} />
          <span className="ml-auto"><StatusBadge status="pending_admin_review" /></span>
        </header>
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-card border border-border bg-surface-muted">
                {product?.images?.[0] ? <img src={product.images[0]} alt="" className="h-full w-full object-contain p-1.5" /> : "—"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Product snapshot</p>
                <h2 className="mt-1 text-base font-semibold sm:text-lg">{product?.title ?? "Product unavailable"}</h2>
                <p className="mt-1 text-sm text-muted">{product?.provider_item_id ?? "Provider item pending"} · {product?.provider ?? "Provider pending"}</p>
              </div>
            </div>
            <Button size="sm" loading={working === order.id} onClick={() => confirm(order.id)}>Confirm and queue</Button>
          </div>
          {uncovered > 0 && <Alert className="mt-5" variant="warning" title="Wallet payment still required">CNY {uncovered.toFixed(2)} is not covered by the client wallet reservation.</Alert>}
          <div className="mt-5 overflow-x-auto rounded-card border border-border">
            <table className="min-w-[760px] w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted"><tr><th className="p-3">SKU / color / size</th><th>Expected price</th><th>Qty</th><th>Subtotal</th><th>Status</th></tr></thead>
              <tbody className="divide-y divide-border">{lines.map((line: any) => <tr key={line.id} className="align-top">
                <td className="p-3"><div className="flex items-start gap-3">{line.sku?.image_url && <img src={line.sku.image_url} alt="" className="h-12 w-12 rounded border border-border object-contain p-1" />}<div><p className="font-semibold">{line.sku?.label ?? "Variant unavailable"}</p><p className="mt-1 text-xs text-muted">{Object.entries(line.sku?.attributes ?? {}).map(([key, value]) => `${key}: ${value}`).join(" · ") || "No attributes"}</p></div></div></td>
                <td>¥{Number(line.cny_price ?? 0).toFixed(2)}</td><td className="font-semibold">{line.quantity}</td><td>¥{(Number(line.cny_price ?? 0) * Number(line.quantity ?? 0)).toFixed(2)}</td><td><StatusBadge status={line.status} /></td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3"><Field label="Product total" value={`CNY ${productTotal.toFixed(2)}`} /><Field label="Domestic delivery" value={`CNY ${domesticTotal.toFixed(2)}`} /><Field label="SKU lines" value={String(lines.length)} /></div>
        </div>
      </Card>;
    })}
  </section>;
}

function Field({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">{label}</p><p className="mt-1 max-w-[20rem] truncate font-semibold" title={value}>{value}</p></div>;
}
