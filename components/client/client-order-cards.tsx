"use client";
import { Building2, ChevronDown, ChevronUp, ClipboardCheck, Heart, Package, Ship, Store, Warehouse } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert, Badge, Card, PriceDisplay, ProductThumbnail, StatusBadge } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import type { OrderStatus } from "@/lib/domain/types";
type Sku = {
  id: string;
  imageUrl: string | null;
  description: string;
  color: string | null;
  size: string | null;
  unitPriceCny: number | string | null;
  quantity: number;
  subtotalCny: number | string | null;
  subtotalBdt: number | string | null;
  status: OrderStatus;
  note: string | null;
};
type OrderCardData = {
  orderId: string;
  productId: string | null;
  displayOrderNumber: string;
  orderedAt: string;
  product: {
    imageUrl: string | null;
    productUrl?: string | null;
    shortDescription: string;
    storeName: string | null;
    storeAccount: string | null;
  };
  skus: Sku[];
  supplierTotalCny: number | string | null;
  supplierTotalBdt: number | string | null;
  shippingTotalCny: number | string | null;
  shippingTotalBdt: number | string | null;
  totalAmountBdt: number | string | null;
  totalAmountState: "actual" | "estimated" | "partial" | "unavailable";
  status: OrderStatus;
  walletCoverage: {
    requiredCny: number | string;
    reservedCny: number | string;
    coveredCny: number | string;
    uncoveredCny: number | string;
    rateCnyToBdt: number | string | null;
    committed: boolean;
  };
  favorite: { eligible: boolean; active: boolean; favoriteId: string | null };
};
export function ClientOrderCards({ orders }: { orders: unknown[] }) {
  return (
    <section data-page-section="client-orders" className="mt-7 space-y-5" aria-label="Order history">
      {orders.map((value) => (
        <OrderCard
          key={(value as OrderCardData).orderId}
          order={value as OrderCardData}
        />
      ))}
    </section>
  );
}
function OrderCard({ order }: { order: OrderCardData }) {
  const [expanded, setExpanded] = useState(false);
  const [favorite, setFavorite] = useState(order.favorite);
  const [busy, setBusy] = useState(false);
  const uncovered = Number(order.walletCoverage?.uncoveredCny ?? 0);
  async function toggleFavorite() {
    const itemId = order.skus[0]?.id;
    if (!itemId || !favorite.eligible || busy) return;
    setBusy(true);
    try {
      if (favorite.active && favorite.favoriteId) {
        const r = await fetch(`/api/favorites/${favorite.favoriteId}`, {
          method: "DELETE",
        });
        if (r.ok) setFavorite({ ...favorite, active: false, favoriteId: null });
      } else {
        const r = await fetch("/api/favorites", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderItemId: itemId }),
        });
        const p = (await r.json().catch(() => null)) as {
          data?: { id?: string };
        } | null;
        if (r.ok)
          setFavorite({
            ...favorite,
            active: true,
            favoriteId: p?.data?.id ?? null,
          });
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card data-ui="client-order-card" className="overflow-hidden border-border shadow-soft">
      <header className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border bg-surface-muted/80 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="hidden sm:block"><Field label="Product ID" value={order.productId || "Not available"} /></div>
        <span className="hidden h-8 w-px bg-border sm:block" />
        <Field label="Order number" value={order.displayOrderNumber} />
        <span className="hidden h-8 w-px bg-border sm:block" />
        <div className="hidden sm:block"><Field
          label="Order date"
          value={new Intl.DateTimeFormat("en-BD", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(order.orderedAt))}
        /></div>
        <span className="ml-auto shrink-0">
          <StatusBadge status={order.status} />
        </span>
      </header>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-4">
            <ProductThumbnail src={order.product.imageUrl} alt={order.product.shortDescription} size="xl" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                Product snapshot
              </p>
              <h2 className="mt-1 max-w-2xl text-base font-semibold leading-6 sm:text-lg">
                {order.product.shortDescription}
              </h2>
              <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted">
                <Store className="h-4 w-4" />
                {order.product.storeName || "Store information pending"}
              </p>
              <p className="mt-1 text-xs font-medium text-muted">
                {order.skus.length} {order.skus.length === 1 ? "SKU" : "SKUs"} · {order.skus.reduce((total, sku) => total + sku.quantity, 0)} pcs
              </p>
            </div>
          </div>
          <div className="flex min-w-[8rem] flex-1 flex-col items-start gap-2 sm:flex-none sm:items-end">
            <div className="sm:text-right">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">Order total</p>
              <div className="mt-1 text-lg font-bold leading-6 text-foreground sm:text-xl">
                {order.totalAmountBdt === null ? "Not available" : <PriceDisplay value={order.totalAmountBdt} currency="BDT" showCode size="lg" />}
              </div>
            </div>
            <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className={buttonClasses({ variant: "outline", size: "sm" })}
            >
              {expanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {expanded ? "Hide details" : "View details"}
            </button>
            {favorite.eligible && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void toggleFavorite()}
                className={buttonClasses({ variant: "ghost", size: "sm" })}
              >
                <Heart className="h-4 w-4" />
                {busy
                  ? "Saving…"
                  : favorite.active
                    ? "Favorited"
                    : "Add to favorite"}
              </button>
            )}
            </div>
          </div>
        </div>
        <OrderProgress status={order.status} />
        {expanded && (
          <>
            {uncovered > 0 && (
              <Alert
                className="mt-5"
                variant="warning"
                title="Payment still required"
              >
                CNY {uncovered.toFixed(2)} of the supplier cost is not covered
                by this wallet reservation. The order continues and remains
                pending payment.
              </Alert>
            )}
            <div className="mt-5 space-y-3 lg:hidden">
              {order.skus.map((sku) => <MobileSkuRow key={sku.id} sku={sku} />)}
            </div>
            <div className="mt-5 hidden overflow-x-auto rounded-card border border-border lg:block">
              <table className="min-w-[820px] w-full text-left text-sm">
                <thead className="bg-surface-muted text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th>Price</th>
                    <th>Qty</th>
                    <th>Subtotal (CNY)</th>
                    <th>Subtotal (BDT)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {order.skus.map((sku) => (
                    <SkuRow key={sku.id} sku={sku} />
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-5 grid gap-4 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-5">
              <Summary
                label="Total amount (BDT)"
                value={
                  order.totalAmountBdt === null ? (
                    "Not available"
                  ) : (
                    <PriceDisplay
                      value={order.totalAmountBdt}
                      currency="BDT"
                      showCode
                      size="lg"
                    />
                  )
                }
                detail={
                  <Badge
                    variant={
                      order.totalAmountState === "actual"
                        ? "success"
                        : "warning"
                    }
                  >
                    {order.totalAmountState}
                  </Badge>
                }
              />
              <Summary
                label="Supplier total"
                value={
                  order.supplierTotalCny === null ? (
                    "Not available"
                  ) : (
                    <>
                      <PriceDisplay
                        value={order.supplierTotalCny}
                        currency="CNY"
                        showCode
                      />
                      <br />
                      <PriceDisplay
                        value={order.supplierTotalBdt ?? 0}
                        currency="BDT"
                        showCode
                        size="sm"
                      />
                    </>
                  )
                }
                detail="Product cost"
              />
              <Summary
                label="Wallet coverage"
                value={
                  <>
                    <PriceDisplay
                      value={order.walletCoverage?.coveredCny ?? 0}
                      currency="CNY"
                      showCode
                    />
                    <br />
                    <span className="text-sm text-warning">
                      CNY {uncovered.toFixed(2)} uncovered
                    </span>
                  </>
                }
                detail={`${order.walletCoverage?.committed ? "Debited" : "Reserved"}${order.walletCoverage?.rateCnyToBdt ? ` · ${Number(order.walletCoverage.rateCnyToBdt).toFixed(4)} BDT/CNY` : ""}`}
              />
              <Summary
                label="Domestic shipping"
                value={
                  order.shippingTotalCny === null ? (
                    "Not available"
                  ) : (
                    <>
                      <PriceDisplay
                        value={order.shippingTotalCny}
                        currency="CNY"
                        showCode
                      />
                      <br />
                      <PriceDisplay
                        value={order.shippingTotalBdt ?? 0}
                        currency="BDT"
                        showCode
                        size="sm"
                      />
                    </>
                  )
                }
                detail="Seller to China warehouse"
              />
              <Summary
                label="Order behavior"
                value={
                  order.product.productUrl ? (
                    <Link
                      href={`/client/order/new?url=${encodeURIComponent(order.product.productUrl)}`}
                      className={buttonClasses({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Purchase again
                    </Link>
                  ) : (
                    "Repeat link pending"
                  )
                }
                detail="Uses current pricing"
              />
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-muted">
        {label}
      </p>
      <p className="mt-1 max-w-[19rem] truncate font-semibold" title={value}>
        {value}
      </p>
    </div>
  );
}

const orderStages = [
  { label: "Purchase", icon: ClipboardCheck },
  { label: "China warehouse", icon: Warehouse },
  { label: "Guangzhou", icon: Building2 },
  { label: "Bangladesh", icon: Ship },
  { label: "Pickup", icon: Package }
] as const;

function OrderProgress({ status }: { status: OrderStatus }) {
  const activeStage = stageForOrderStatus(status);
  if (activeStage === null) return null;
  return (
    <div data-ui="order-progress" className="mt-5 border-t border-border pt-4">
      <ol className="grid grid-cols-5 gap-1" aria-label="Order fulfillment progress">
        {orderStages.map(({ label, icon: Icon }, index) => {
          const complete = index < activeStage;
          const current = index === activeStage;
          return <li key={label} className="relative min-w-0 text-center">
            {index > 0 && <span aria-hidden="true" className={`absolute right-1/2 top-4 h-0.5 w-full ${complete || current ? "bg-action-primary/75" : "border-t-2 border-dashed border-border"}`} />}
            <span className={`relative z-[1] mx-auto grid h-8 w-8 place-items-center rounded-full border bg-surface ${current ? "border-action-primary bg-action-primary text-on-action shadow-soft" : complete ? "border-action-primary/45 bg-action-soft text-action-primary" : "border-border text-muted"}`}>
              <Icon aria-hidden="true" className="h-3.5 w-3.5" />
            </span>
            <span className={`mt-1.5 block break-words text-[0.63rem] font-semibold leading-3.5 ${current ? "text-foreground" : complete ? "text-action-primary" : "text-muted"}`}>{label}</span>
          </li>;
        })}
      </ol>
    </div>
  );
}

function stageForOrderStatus(status: OrderStatus) {
  if (["pending_admin_review", "confirmed", "queued_for_purchase", "purchased", "seller_shipped"].includes(status)) return 0;
  if (["received_china", "qc_checked", "packed"].includes(status)) return 1;
  if (["sent_guangzhou", "arrived_guangzhou"].includes(status)) return 2;
  if (["sent_bangladesh", "arrived_bangladesh"].includes(status)) return 3;
  if (["ready_for_pickup", "completed"].includes(status)) return 4;
  return null;
}

function SkuRow({ sku }: { sku: Sku }) {
  return (
    <tr className="align-top">
      <td className="p-3">
        <div className="flex min-w-[22rem] items-start gap-3">
          <ProductThumbnail src={sku.imageUrl} alt={sku.description || "Product variant"} />
          <div>
            <p className="font-semibold">
              {sku.description || "SKU details unavailable"}
            </p>
            <div className="mt-1 flex gap-3 text-xs text-muted">
              {sku.color && <span>Color: {sku.color}</span>}
              {sku.size && <span>Size: {sku.size}</span>}
            </div>
            {sku.note && <p className="mt-2 text-xs text-muted">{sku.note}</p>}
          </div>
        </div>
      </td>
      <td className="p-3">
        <PriceDisplay
          value={sku.unitPriceCny ?? 0}
          currency="CNY"
          showCode
          size="sm"
        />
      </td>
      <td className="p-3 font-semibold tabular-nums">{sku.quantity}</td>
      <td className="p-3">
        {sku.subtotalCny === null ? (
          "Not available"
        ) : (
          <PriceDisplay
            value={sku.subtotalCny}
            currency="CNY"
            showCode
            size="sm"
          />
        )}
      </td>
      <td className="p-3">
        {sku.subtotalBdt === null ? (
          "Not available"
        ) : (
          <PriceDisplay
            value={sku.subtotalBdt}
            currency="BDT"
            showCode
            size="sm"
          />
        )}
      </td>
      <td className="p-3">
        <StatusBadge status={sku.status} />
      </td>
    </tr>
  );
}
function MobileSkuRow({ sku }: { sku: Sku }) {
  return (
    <div className="rounded-control border border-border bg-surface-muted/55 p-3">
      <div className="flex min-w-0 items-start gap-3">
        <ProductThumbnail src={sku.imageUrl} alt={sku.description || "Product variant"} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 text-sm font-semibold leading-5 text-foreground">{sku.description || "SKU details unavailable"}</p>
            <StatusBadge status={sku.status} className="shrink-0" />
          </div>
          {(sku.color || sku.size) && <p className="mt-1 text-xs text-muted">{[sku.color, sku.size].filter(Boolean).join(" · ")}</p>}
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs">
            <div><p className="text-muted">Unit price</p><PriceDisplay value={sku.unitPriceCny ?? 0} currency="CNY" showCode size="sm" className="mt-0.5" /></div>
            <div><p className="text-muted">Quantity</p><p className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">{sku.quantity}</p></div>
            <div><p className="text-muted">Subtotal</p>{sku.subtotalCny === null ? <p className="mt-0.5 text-sm font-semibold text-muted">Not available</p> : <PriceDisplay value={sku.subtotalCny} currency="CNY" showCode size="sm" className="mt-0.5" />}</div>
          </div>
          {sku.note && <p className="mt-3 border-t border-border pt-3 text-xs leading-5 text-muted">{sku.note}</p>}
        </div>
      </div>
    </div>
  );
}
function Summary({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
        {label}
      </p>
      <div className="mt-1 font-semibold">{value}</div>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </div>
  );
}
