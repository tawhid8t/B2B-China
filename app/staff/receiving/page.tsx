"use client";

import { AppShell } from "@/components/app-shell";
import { Camera, PackageCheck, ScanBarcode } from "lucide-react";
import { useState } from "react";

export default function ReceivingPage() {
  const [pieces, setPieces] = useState(12);
  return <AppShell title="Warehouse receiving" eyebrow="Receiving and QC"><div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]"><section className="rounded-lg border border-line bg-white p-5 shadow-panel"><div className="grid aspect-[4/3] place-items-center rounded-lg border-2 border-dashed border-line bg-paper"><div className="text-center"><ScanBarcode className="mx-auto text-jade" size={42} /><p className="mt-3 font-semibold">Scan parcel barcode</p><p className="mt-1 text-sm text-ink/60">Scan or search the incoming supplier parcel.</p></div></div><button className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md bg-jade px-4 py-3 text-sm font-semibold text-white"><Camera size={16} /> Open camera</button></section><section className="rounded-lg border border-line bg-white p-5 shadow-panel"><h3 className="text-xl font-semibold">Parcel receipt</h3><div className="mt-5 grid gap-4 md:grid-cols-2"><label className="text-sm">Pieces in package<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" value={pieces} onChange={(event) => setPieces(Number(event.target.value))} /></label><label className="text-sm">Weight kg<input className="mt-1 w-full rounded-md border border-line px-3 py-2" type="number" defaultValue="4.20" /></label><label className="text-sm">QC status<select className="mt-1 w-full rounded-md border border-line px-3 py-2"><option>Pass</option><option>Partial</option><option>Fail</option><option>Missing</option></select></label></div><button className="mt-5 inline-flex items-center gap-2 rounded-md bg-jade px-4 py-2 text-sm font-semibold text-white"><PackageCheck size={16} /> Record receipt</button></section></div></AppShell>;
}
