"use client";

import { AppShell } from "@/components/app-shell";
import { Camera, PackagePlus, Printer, ScanBarcode } from "lucide-react";
import { useState } from "react";

export default function StaffPage() {
  const [pieces, setPieces] = useState(12);

  return (
    <AppShell title="Warehouse receiving" eyebrow="Mobile staff workflow">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <div className="grid aspect-[4/3] place-items-center rounded-lg border-2 border-dashed border-line bg-paper">
            <div className="text-center">
              <ScanBarcode className="mx-auto text-jade" size={42} />
              <p className="mt-3 font-semibold">Scan parcel barcode</p>
              <p className="mt-1 text-sm text-ink/60">Camera integration can use BarcodeDetector or a library fallback.</p>
            </div>
          </div>
          <button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-jade px-4 py-3 text-sm font-semibold text-white">
            <Camera size={16} /> Open camera
          </button>
        </section>

        <section className="rounded-lg border border-line bg-white p-5 shadow-panel">
          <h3 className="text-xl font-semibold">Parcel details</h3>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Pieces in package
              <input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={pieces} onChange={(event) => setPieces(Number(event.target.value))} />
            </label>
            <label className="text-sm">
              Weight kg
              <input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" defaultValue="4.20" />
            </label>
            <label className="text-sm">
              QC status
              <select className="mt-1 w-full rounded-md border border-line px-3 py-2">
                <option>Pass</option>
                <option>Partial</option>
                <option>Fail</option>
                <option>Missing</option>
              </select>
            </label>
            <label className="text-sm">
              Carton category
              <select className="mt-1 w-full rounded-md border border-line px-3 py-2">
                <option>Apparel</option>
                <option>Electronics</option>
                <option>Home</option>
              </select>
            </label>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="inline-flex items-center gap-2 rounded-md bg-jade px-4 py-2 text-sm font-semibold text-white">
              <PackagePlus size={16} /> Create carton
            </button>
            <button className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold">
              <Printer size={16} /> Print label
            </button>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
