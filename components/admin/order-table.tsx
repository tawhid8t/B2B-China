"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, EmptyState, StatusBadge } from "@/components/ui";
import type { OrderStatus } from "@/lib/domain/types";

type Order = any;

export function AdminOrderTable({
  orders,
  mode = "all",
}: {
  orders: Order[];
  mode?: "review" | "queue" | "all";
}) {
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [working, setWorking] = useState<string>();
  async function update(orderId: string, action: "approve" | "queue") {
    setWorking(orderId);
    setError(undefined);
    try {
      const response = await fetch(
        `/api/admin/orders/${orderId}/${action === "approve" ? "approve" : "queue-for-purchase"}`,
        { method: "POST" },
      );
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error?.message ?? "Operation failed.");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operation failed.");
    } finally {
      setWorking(undefined);
    }
  }
  if (!orders.length)
    return (
      <EmptyState
        title="No data yet"
        description={
          mode === "review"
            ? "There are no orders waiting for review."
            : "No orders match this workspace."
        }
      />
    );
  return (
    <div className="space-y-3">
      {error && (
        <Alert variant="danger" title="Action failed">
          {error}
        </Alert>
      )}
      <div className="overflow-x-auto rounded-card border border-border bg-surface">
        <table className="w-full min-w-[1080px] text-left text-sm">
          <thead className="border-b border-border bg-surface-muted text-xs font-bold uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th>Client</th>
              <th>Variant</th>
              <th>Qty</th>
              <th>Estimate</th>
              <th>Wallet coverage</th>
              <th>Status</th>
              <th className="px-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((order) => {
              const product = order.product;
              const sku = order.sku;
              return (
                <tr key={order.id}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">
                      {product?.title ?? "Product unavailable"}
                    </p>
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      {order.id.slice(0, 8)}
                    </p>
                  </td>
                  <td>{order.client?.business_name ?? "—"}</td>
                  <td>
                    <p>{sku?.label ?? "—"}</p>
                    <p className="text-xs text-muted">
                      {Object.values(sku?.attributes ?? {}).join(" / ") ||
                        "No attributes"}
                    </p>
                  </td>
                  <td>{order.quantity}</td>
                  <td>¥{Number(order.cny_price ?? 0).toFixed(2)}</td>
                  <td>
                    <p className="font-semibold">
                      CNY{" "}
                      {Number(
                        order.wallet_committed_at
                          ? order.wallet_committed_cny
                          : order.wallet_reserved_cny,
                      ).toFixed(2)}{" "}
                      {order.wallet_committed_at ? "debited" : "reserved"}
                    </p>
                    <p
                      className={
                        Number(order.wallet_uncovered_cny) > 0
                          ? "text-xs font-semibold text-warning"
                          : "text-xs text-muted"
                      }
                    >
                      CNY {Number(order.wallet_uncovered_cny ?? 0).toFixed(2)}{" "}
                      uncovered
                    </p>
                    {order.wallet_rate_cny_to_bdt && (
                      <p className="text-xs text-muted">
                        {Number(order.wallet_rate_cny_to_bdt).toFixed(4)}{" "}
                        BDT/CNY
                      </p>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={order.status as OrderStatus} />
                  </td>
                  <td className="px-4">
                    <div className="flex gap-2">
                      <Link
                        className="text-sm font-semibold text-commerce-700 underline"
                        href={`/admin/orders/${order.id}`}
                      >
                        View
                      </Link>
                      {order.status === "pending_admin_review" && (
                        <Button
                          size="sm"
                          loading={working === order.id}
                          onClick={() => update(order.id, "approve")}
                        >
                          Approve
                        </Button>
                      )}
                      {order.status === "confirmed" && mode !== "review" && (
                        <Button
                          size="sm"
                          loading={working === order.id}
                          onClick={() => update(order.id, "queue")}
                        >
                          Queue
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
