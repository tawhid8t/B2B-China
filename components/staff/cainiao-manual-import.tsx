"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ClipboardPlus, MapPin, PackageCheck, RotateCcw, ScanLine, Truck } from "lucide-react";
import { useRef, useState } from "react";

type ParcelResult = {
  trackingNumber: string;
  parcelId: string;
  status: string;
  matchedOrderItemCount: number;
  outcome: "imported" | "updated";
};

type ImportResult = {
  importBatchId: string;
  totals: {
    submitted: number;
    inserted: number;
    refreshed: number;
    matched: number;
    unmatched: number;
  };
  parcels: ParcelResult[];
};

type ApiError = { error?: { message?: string } };

const defaultFields = {
  pickupCode: "",
  trackingNumber: "",
  carrier: "",
  pickupStation: "",
  status: "ready_for_pickup",
};

export function CainiaoManualImport() {
  const [fields, setFields] = useState(defaultFields);
  const [showOptional, setShowOptional] = useState(false);
  const [submitting, setSubmitting] = useState<"save" | "addAnother" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latest, setLatest] = useState<ImportResult | null>(null);
  const [recent, setRecent] = useState<ParcelResult[]>([]);
  const trackingInput = useRef<HTMLInputElement>(null);

  function updateField(name: keyof typeof defaultFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }));
  }

  async function submit(intent: "save" | "addAnother") {
    setError(null);
    setSubmitting(intent);

    try {
      const response = await fetch("/api/staff/cainiao-imports/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcels: [
            {
              pickupCode: fields.pickupCode,
              trackingNumber: fields.trackingNumber,
              carrier: fields.carrier || undefined,
              pickupStation: fields.pickupStation || undefined,
              status: fields.status,
            },
          ],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { data?: ImportResult } & ApiError;
      if (!response.ok || !payload.data) {
        throw new Error(payload.error?.message ?? "Cainiao parcel could not be saved. Please try again.");
      }

      setLatest(payload.data);
      setRecent((current) => [...payload.data!.parcels, ...current].slice(0, 5));
      setFields(defaultFields);
      setShowOptional(false);
      if (intent === "addAnother") requestAnimationFrame(() => trackingInput.current?.focus());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Cainiao parcel could not be saved. Please try again.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-panel border border-line bg-white p-4 shadow-soft sm:p-6">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-jade/10 text-jade">
            <ScanLine size={23} aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-ink">Add a Cainiao parcel</h3>
            <p className="mt-1 text-sm leading-6 text-ink/65">Copy the pickup code and tracking number from the Cainiao mobile app. The system will match by tracking number only.</p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={(event) => { event.preventDefault(); void submit("save"); }}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Tracking number"
              required
              autoFocus
              autoComplete="off"
              inputMode="text"
              placeholder="Paste courier tracking number"
              value={fields.trackingNumber}
              onChange={(event) => updateField("trackingNumber", event.target.value)}
              ref={trackingInput}
              startAdornment={<Truck size={18} />}
            />
            <Input
              label="Pickup code"
              required
              autoComplete="off"
              inputMode="numeric"
              placeholder="Example: 13-3-1059"
              value={fields.pickupCode}
              onChange={(event) => updateField("pickupCode", event.target.value)}
              startAdornment={<PackageCheck size={18} />}
            />
          </div>

          <label className="block text-sm font-semibold text-foreground">
            Cainiao status
            <select
              className="focus-ring mt-1.5 min-h-touch-lg w-full rounded-control border border-border bg-surface px-3.5 py-2.5 text-base text-foreground shadow-sm sm:text-sm"
              value={fields.status}
              onChange={(event) => updateField("status", event.target.value)}
            >
              <option value="ready_for_pickup">Ready for pickup</option>
              <option value="arriving_soon">Arriving soon</option>
              <option value="in_transit">In transit</option>
              <option value="returned">Returned / exception</option>
            </select>
          </label>

          <button
            type="button"
            className="focus-ring flex min-h-touch items-center gap-2 text-sm font-semibold text-jade hover:text-jade/80"
            aria-expanded={showOptional}
            onClick={() => setShowOptional((visible) => !visible)}
          >
            <ChevronDown size={18} className={showOptional ? "rotate-180 transition-transform" : "transition-transform"} aria-hidden="true" />
            {showOptional ? "Hide" : "Add"} courier and station details
          </button>

          {showOptional && (
            <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-2">
              <Input label="Courier / carrier" autoComplete="off" placeholder="Example: ZTO" value={fields.carrier} onChange={(event) => updateField("carrier", event.target.value)} startAdornment={<Truck size={18} />} />
              <Input label="Pickup station" autoComplete="off" placeholder="Example: Campus Cainiao station" value={fields.pickupStation} onChange={(event) => updateField("pickupStation", event.target.value)} startAdornment={<MapPin size={18} />} />
            </div>
          )}

          {error && <Alert variant="danger" title="Parcel not saved">{error}</Alert>}

          <div className="flex flex-col gap-3 border-t border-line pt-5 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto" loading={submitting === "save"} disabled={submitting !== null}>
              <ClipboardPlus size={18} aria-hidden="true" /> Save parcel
            </Button>
            <Button type="button" variant="outline" className="w-full sm:w-auto" loading={submitting === "addAnother"} disabled={submitting !== null} onClick={() => void submit("addAnother")}>
              <RotateCcw size={18} aria-hidden="true" /> Save & add another
            </Button>
          </div>
        </form>
      </section>

      <aside className="space-y-4">
        <Alert variant="info" title="Collection is separate">Saving a pickup code does not mark the parcel collected or complete QC.</Alert>
        {latest && (
          <Alert variant={latest.totals.unmatched > 0 ? "warning" : "success"} title="Import saved" role="status">
            {latest.totals.matched} matched · {latest.totals.unmatched} needs review · {latest.totals.inserted} new · {latest.totals.refreshed} updated
          </Alert>
        )}
        <section className="rounded-panel border border-line bg-white p-4 shadow-soft">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-ink/65">This session</h3>
          {recent.length === 0 ? (
            <p className="mt-3 text-sm leading-6 text-ink/60">Saved parcels will appear here, so you can avoid entering the same tracking number twice.</p>
          ) : (
            <ul className="mt-3 divide-y divide-line">
              {recent.map((parcel) => (
                <li key={`${parcel.parcelId}-${parcel.trackingNumber}`} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-mono text-sm font-semibold text-ink">{parcel.trackingNumber}</p>
                  <p className="mt-1 text-xs text-ink/60">{parcel.outcome === "imported" ? "Saved" : "Updated"} · {parcel.matchedOrderItemCount > 0 ? `${parcel.matchedOrderItemCount} order item${parcel.matchedOrderItemCount === 1 ? "" : "s"} matched` : "Unmatched"}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </div>
  );
}
