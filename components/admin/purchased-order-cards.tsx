/* eslint-disable @next/next/no-img-element -- provider and SKU image hosts are dynamic. */
import { Card, StatusBadge } from "@/components/ui";

type ProviderOrder = any;

const money = (value: unknown) => `¥${Number(value ?? 0).toFixed(2)}`;
const attributes = (value: unknown) => Object.entries((value ?? {}) as Record<string, unknown>).map(([key, item]) => `${key}: ${item}`).join(" · ");

export function PurchasedOrderCards({ rows }: { rows: ProviderOrder[] }) {
  const groups = new Map<string, ProviderOrder[]>();
  for (const row of rows) {
    const item = row.order_item ?? {}, product = item.product ?? {};
    const key = `${row.provider_order_id ?? row.id}:${item.product_order_id ?? product.id ?? item.id}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return <section className="space-y-5" aria-label="Purchased provider orders">{[...groups.values()].map((items) => <PurchasedProductCard key={`${items[0].provider_order_id}-${items[0].order_item?.product_order_id}`} items={items} />)}</section>;
}

function PurchasedProductCard({ items }: { items: ProviderOrder[] }) {
  const first = items[0], orderItem = first.order_item ?? {}, product = orderItem.product ?? {}, client = orderItem.client ?? {};
  const expected = items.reduce((sum, item) => sum + Number(item.order_item?.cny_price ?? 0) * Number(item.quantity_purchased ?? item.order_item?.quantity ?? 0) + Number(item.order_item?.domestic_delivery_cny ?? 0), 0);
  const actual = items.reduce((sum, item) => sum + Number(item.paid_amount_cny ?? 0), 0);
  const image = product.images?.[0] ?? orderItem.sku?.image_url;
  const trackingNumbers = [...new Set(items.flatMap((item) => item.trackingNumbers ?? []).concat(items.map((item) => item.seller_tracking_number).filter(Boolean)))];
  if (trackingNumbers.length) first.seller_tracking_number = trackingNumbers.join(" · ");
  return <Card className="overflow-hidden border-border shadow-soft"><header className="flex flex-wrap items-start gap-4 border-b border-border bg-surface-muted p-4 sm:p-5"><div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-card border border-border bg-surface">{image ? <img src={image} alt="" className="h-full w-full object-contain p-1.5" /> : <span className="text-muted">No image</span>}</div><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Purchased product</p><h2 className="mt-1 text-base font-semibold sm:text-lg">{product.title ?? "Product"}</h2><p className="mt-1 text-sm text-muted">Client: <strong className="text-foreground">{client.business_name ?? "—"}</strong> · {items.length} SKU line{items.length === 1 ? "" : "s"}</p></div><StatusBadge status="purchased" /></header><div className="grid gap-3 border-b border-border p-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Metric label="Provider order" value={first.provider_order_id ?? "—"} /><Metric label="Expected total" value={money(expected)} /><Metric label="Final paid" value={money(actual)} /><Metric label="Tracking" value={first.seller_tracking_number ?? "Not available yet"} /></div><div className="divide-y divide-border">{items.map((item) => <PurchasedSkuRow key={item.id} item={item} />)}</div></Card>;
}

function PurchasedSkuRow({ item }: { item: ProviderOrder }) {
  const orderItem = item.order_item ?? {}, sku = orderItem.sku ?? {}, quantity = Number(item.quantity_purchased ?? orderItem.quantity ?? 0), expectedUnit = Number(orderItem.cny_price ?? 0), expectedDelivery = Number(orderItem.domestic_delivery_cny ?? 0), expectedTotal = expectedUnit * quantity + expectedDelivery;
  return <div className="grid gap-4 p-4 sm:grid-cols-[minmax(16rem,1.6fr)_repeat(3,minmax(7rem,1fr))]"><div className="flex min-w-0 gap-3"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded border border-border bg-surface-muted">{sku.image_url ? <img src={sku.image_url} alt="" className="h-full w-full object-contain p-1" /> : "—"}</div><div className="min-w-0"><p className="font-semibold">{sku.label ?? "SKU selection"}</p><p className="mt-1 text-xs text-muted">{attributes(sku.attributes) || "Supplier SKU details not supplied"}</p></div></div><Metric label="Quantity / status" value={`${quantity} · Purchased`} /><Metric label="Expected" value={`Unit ${money(expectedUnit)} · Total ${money(expectedTotal)}`} /><Metric label="Actual supplier cost" value={`Unit ${money(item.actual_unit_price_cny)} · Delivery ${money(item.actual_domestic_delivery_cny)} · Paid ${money(item.paid_amount_cny)}`} /></div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</p><p className="mt-1 break-words font-semibold tabular-nums">{value}</p></div>; }
