"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Link2, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Parcel = { id: string; trackingNumber: string; pickupCode: string | null; carrier: string | null; pickupStation: string | null; unmatched: boolean };
type Candidate = { order_item_id: string; provider_order_id: string; product_title: string; sku_label: string; quantity: number; client_business_name: string };

export function CainiaoUnmatchedReview() {
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [queueResponse, candidatesResponse] = await Promise.all([
        fetch("/api/staff/cainiao-parcels/collection", { cache: "no-store" }),
        fetch("/api/admin/cainiao-parcels/link-candidates", { cache: "no-store" }),
      ]);
      const queue = await queueResponse.json().catch(() => ({}));
      const candidateData = await candidatesResponse.json().catch(() => ({}));
      if (!queueResponse.ok || !queue.data) throw new Error(queue.error?.message ?? "Unmatched parcels could not be loaded.");
      if (candidatesResponse.status === 403) { setCandidates(null); return; }
      if (!candidatesResponse.ok || !candidateData.data) throw new Error(candidateData.error?.message ?? "Link candidates could not be loaded.");
      setParcels((queue.data.parcels as Parcel[]).filter((parcel) => parcel.unmatched));
      setCandidates(candidateData.data.candidates as Candidate[]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unmatched parcels could not be loaded."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function link(parcel: Parcel) {
    const orderItemId = selected[parcel.id]; const reason = reasons[parcel.id]?.trim();
    if (!orderItemId || !reason) { setError("Choose an order item and write why this tracking number belongs to it."); return; }
    setSaving(parcel.id); setError(null);
    try {
      const response = await fetch(`/api/admin/cainiao-parcels/${encodeURIComponent(parcel.trackingNumber)}/link`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderItemId, reason }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error?.message ?? "Cainiao parcel could not be linked.");
      await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Cainiao parcel could not be linked."); }
    finally { setSaving(null); }
  }

  if (candidates === null && !loading) return null;
  return <section className="mx-auto mt-8 max-w-5xl border-t border-line pt-8">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase tracking-wide text-coral">Admin review</p><h3 className="mt-1 text-2xl font-semibold text-ink">Unmatched Cainiao parcels</h3><p className="mt-1 text-sm text-ink/65">Link only after verifying the tracking number against the provider order. This does not declare parcel quantity or complete QC.</p></div><Button variant="outline" onClick={() => void load()} loading={loading}><RefreshCw size={17} /> Refresh</Button></div>
    {error && <Alert className="mt-5" variant="danger" title="Parcel linking needs attention">{error}</Alert>}
    {!loading && parcels.length === 0 && <Alert className="mt-5" variant="success" title="No unmatched parcels">Every Cainiao parcel currently has a verified item link.</Alert>}
    <div className="mt-5 space-y-4">{parcels.map((parcel) => <article key={parcel.id} className="rounded-panel border border-amber-300 bg-white p-4 shadow-soft"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-mono font-semibold text-ink">{parcel.trackingNumber}</p><p className="mt-1 text-sm text-ink/65">{parcel.carrier ?? "Courier not supplied"} · Pickup code {parcel.pickupCode ?? "not supplied"}</p>{parcel.pickupStation && <p className="mt-1 text-sm text-ink/65">{parcel.pickupStation}</p>}</div><span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Needs verified link</span></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className="block text-sm font-semibold text-ink">Provider-backed order item<select className="mt-1.5 min-h-touch w-full rounded-control border border-line bg-white px-3 py-2 text-sm" value={selected[parcel.id] ?? ""} onChange={(event) => setSelected((state) => ({ ...state, [parcel.id]: event.target.value }))}><option value="">Select an item</option>{candidates?.map((candidate) => <option key={candidate.order_item_id} value={candidate.order_item_id}>{candidate.product_title} · {candidate.sku_label} · qty {candidate.quantity} · {candidate.client_business_name} · 1688 {candidate.provider_order_id}</option>)}</select></label><Input label="Verification reason" required value={reasons[parcel.id] ?? ""} onChange={(event) => setReasons((state) => ({ ...state, [parcel.id]: event.target.value }))} placeholder="Example: confirmed against seller message" /></div><Button className="mt-4" onClick={() => void link(parcel)} loading={saving === parcel.id} disabled={saving !== null || !candidates?.length}><Link2 size={17} /> Confirm verified link</Button></article>)}</div>
  </section>;
}
