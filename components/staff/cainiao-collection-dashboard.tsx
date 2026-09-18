"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ProductThumbnail } from "@/components/ui/product-thumbnail";
import { CheckCircle2, ClipboardCheck, MapPin, PackageOpen, RefreshCw, Route, Truck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type QueueParcel = {
  id: string;
  trackingNumber: string;
  status: string;
  pickupCode: string | null;
  carrier: string | null;
  pickupStation: string | null;
  collectedAt: string | null;
  unmatched: boolean;
  relatedParcelCount: number;
  items: Array<{
    orderItemId: string;
    productTitle: string | null;
    productImage: string | null;
    skuLabel: string | null;
    clientBusinessName: string | null;
    expectedOrderQuantity: number | null;
    expectedPieces: number | null;
  }>;
};

type QueueResponse = {
  summary: {
    readyToCollect: number;
    arrivingSoon: number;
    inTransit: number;
    collectedToday: number;
    unmatched: number;
  };
  parcels: QueueParcel[];
};

const emptyQueue: QueueResponse = {
  summary: { readyToCollect: 0, arrivingSoon: 0, inTransit: 0, collectedToday: 0, unmatched: 0 },
  parcels: [],
};

export function CainiaoCollectionDashboard() {
  const [queue, setQueue] = useState<QueueResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [collecting, setCollecting] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/staff/cainiao-parcels/collection", { cache: "no-store" });
      const payload = (await response.json().catch(() => ({}))) as { data?: QueueResponse; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Collection queue could not be loaded.");
      setQueue(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Collection queue could not be loaded.");
      setQueue(emptyQueue);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  async function markCollected(parcel: QueueParcel) {
    if (!window.confirm(`Mark ${parcel.trackingNumber} as physically collected from Cainiao? This does not complete QC.`)) return;
    setCollecting(parcel.id);
    setError(null);
    try {
      const response = await fetch(`/api/staff/cainiao-parcels/${encodeURIComponent(parcel.trackingNumber)}/collect`, { method: "POST" });
      const payload = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
      if (!response.ok) throw new Error(payload.error?.message ?? "Parcel could not be marked collected.");
      await loadQueue();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Parcel could not be marked collected.");
    } finally {
      setCollecting(null);
    }
  }

  const ready = (queue?.parcels ?? []).filter((parcel) => parcel.status === "delivered" && !parcel.collectedAt);

  return (
    <section className="mx-auto mt-8 max-w-5xl border-t border-line pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-coral">Campus parcel collection</p>
          <h3 className="mt-1 text-2xl font-semibold text-ink">Today&apos;s collection</h3>
        </div>
        <Button variant="outline" onClick={() => void loadQueue()} loading={loading}>
          <RefreshCw size={17} aria-hidden="true" /> Refresh
        </Button>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Ready" value={queue?.summary.readyToCollect ?? "—"} tone="text-jade" />
        <Metric label="Arriving" value={queue?.summary.arrivingSoon ?? "—"} />
        <Metric label="In transit" value={queue?.summary.inTransit ?? "—"} />
        <Metric label="Collected" value={queue?.summary.collectedToday ?? "—"} tone="text-blue-700" />
        <Metric label="Unmatched" value={queue?.summary.unmatched ?? "—"} tone={(queue?.summary.unmatched ?? 0) > 0 ? "text-amber-700" : undefined} />
      </div>

      {error && <Alert className="mt-5" variant="danger" title="Collection action needs attention">{error}</Alert>}
      {loading && !queue ? <p className="mt-6 text-sm text-ink/60">Loading Cainiao collection queue…</p> : null}
      {!loading && ready.length === 0 && <Alert className="mt-6" variant="info" title="No parcels ready to collect">New mobile imports will appear here when their Cainiao status is ready for pickup.</Alert>}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {ready.map((parcel) => <CollectionCard key={parcel.id} parcel={parcel} collecting={collecting === parcel.id} onCollect={() => void markCollected(parcel)} />)}
      </div>
    </section>
  );
}

function Metric({ label, value, tone }: { label: string; value: number | string; tone?: string }) {
  return <div className="rounded-card border border-line bg-white p-3 shadow-soft"><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">{label}</p><p className={`mt-1 text-2xl font-semibold ${tone ?? "text-ink"}`}>{value}</p></div>;
}

function CollectionCard({ parcel, collecting, onCollect }: { parcel: QueueParcel; collecting: boolean; onCollect: () => void }) {
  const primary = parcel.items[0];
  return (
    <article className="rounded-panel border border-jade/25 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-wide text-ink/55">Pickup code</p><p className="mt-1 text-2xl font-bold tracking-wide text-ink">{parcel.pickupCode ?? "Not supplied"}</p></div>
        <span className="rounded-full bg-jade/10 px-3 py-1 text-xs font-semibold text-jade">Ready</span>
      </div>
      <div className="mt-4 flex gap-3 border-y border-line py-4">
        <ProductThumbnail src={primary?.productImage} alt={primary?.productTitle ?? "Unmatched parcel"} size="md" />
        <div className="min-w-0"><p className="line-clamp-2 font-semibold text-ink">{primary?.productTitle ?? "Unmatched Cainiao parcel"}</p><p className="mt-1 font-mono text-xs text-ink/65">{parcel.trackingNumber}</p>{primary?.skuLabel && <p className="mt-1 text-xs text-ink/60">{primary.skuLabel}</p>}</div>
      </div>
      <dl className="mt-4 grid gap-2 text-sm text-ink/70">
        <div className="flex items-center gap-2"><Truck size={16} aria-hidden="true" /><dt className="sr-only">Carrier</dt><dd>{parcel.carrier ?? "Courier not supplied"}</dd></div>
        <div className="flex items-center gap-2"><MapPin size={16} aria-hidden="true" /><dt className="sr-only">Station</dt><dd>{parcel.pickupStation ?? "Station not supplied"}</dd></div>
        <div className="flex items-center gap-2"><PackageOpen size={16} aria-hidden="true" /><dt className="sr-only">Expected order quantity</dt><dd>{primary?.expectedOrderQuantity ? `Expected order quantity: ${primary.expectedOrderQuantity} pcs` : "Expected order quantity is not available"}</dd></div>
        <div className="flex items-center gap-2"><Route size={16} aria-hidden="true" /><dt className="sr-only">Related parcels</dt><dd>{parcel.relatedParcelCount} known parcel{parcel.relatedParcelCount === 1 ? "" : "s"} related to this item</dd></div>
      </dl>
      {parcel.unmatched && <Alert className="mt-4" variant="warning" title="Unmatched tracking">This parcel has no verified product link yet. Do not guess its contents.</Alert>}
      <Button className="mt-5 w-full" loading={collecting} disabled={collecting} onClick={onCollect}><CheckCircle2 size={18} aria-hidden="true" /> Mark collected</Button>
      <p className="mt-2 text-center text-xs text-ink/55"><ClipboardCheck className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Collection moves this parcel to waiting for QC only.</p>
    </article>
  );
}
