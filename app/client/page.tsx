"use client";

import { AppShell } from "@/components/app-shell";
import { useMemo, useState } from "react";
import { Calculator, Link2, UploadCloud, WalletCards } from "lucide-react";

export default function ClientPage() {
  const [quantity, setQuantity] = useState(12);
  const estimate = useMemo(() => {
    const unitCny = 42;
    const domestic = 8;
    const exchange = 16.2;
    const weight = quantity * 0.35;
    const total = (unitCny * quantity + domestic) * exchange + weight * 620 + weight * 35;
    return Math.round(total);
  }, [quantity]);

  return (
    <AppShell title="Client ordering portal" eyebrow="Self-service ordering">
      <div className="grid gap-5 xl:grid-cols-[1fr_0.85fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="flex items-center gap-3">
            <Link2 className="text-jade" />
            <h3 className="text-xl font-semibold">Paste product link</h3>
          </div>
          <div className="mt-5 space-y-4">
            <input className="focus-ring w-full rounded-md border border-line px-4 py-3" defaultValue="https://detail.1688.com/offer/123456789.html" />
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-sm">
                Color
                <select className="mt-1 w-full rounded-md border border-line px-3 py-2">
                  <option>Black</option>
                  <option>White</option>
                </select>
              </label>
              <label className="text-sm">
                Size
                <select className="mt-1 w-full rounded-md border border-line px-3 py-2">
                  <option>M</option>
                  <option>L</option>
                </select>
              </label>
              <label className="text-sm">
                Quantity
                <input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
              </label>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md bg-jade px-4 py-2 text-sm font-semibold text-white">
              <Calculator size={16} /> Request estimate
            </button>
          </div>
        </section>

        <aside className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <h3 className="text-xl font-semibold">Live estimate</h3>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between"><dt>Product + China delivery</dt><dd>¥ {42 * quantity + 8}</dd></div>
            <div className="flex justify-between"><dt>Estimated weight</dt><dd>{(quantity * 0.35).toFixed(2)} kg</dd></div>
            <div className="flex justify-between"><dt>Category shipping</dt><dd>৳ {Math.round(quantity * 0.35 * 620)}</dd></div>
            <div className="flex justify-between"><dt>China to Guangzhou</dt><dd>৳ {Math.round(quantity * 0.35 * 35)}</dd></div>
            <div className="border-t border-line pt-3 text-lg font-semibold flex justify-between"><dt>Total estimate</dt><dd>৳ {estimate.toLocaleString()}</dd></div>
          </dl>
        </aside>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <WalletCards className="text-coral" />
              <div>
                <h3 className="text-lg font-semibold">Wallet and payment history</h3>
                <p className="text-sm text-ink/60">Advance payments are converted to RMB after admin approval.</p>
              </div>
            </div>
            <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold">
              <UploadCloud size={16} /> Upload proof
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
