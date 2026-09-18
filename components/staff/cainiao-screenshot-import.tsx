"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { extractCainiaoCandidates, type CainiaoOcrCandidate } from "@/lib/logistics/cainiao-ocr";
import { CheckCircle2, FileImage, Plus, ScanText, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";

type ImportTotals = { submitted: number; inserted: number; refreshed: number; matched: number; unmatched: number };

const emptyCandidate = (): CainiaoOcrCandidate => ({ trackingNumber: "", pickupCode: "", carrier: "", pickupStation: "", status: "ready_for_pickup", confidence: "low" });

export function CainiaoScreenshotImport() {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [ocrText, setOcrText] = useState("");
  const [candidates, setCandidates] = useState<CainiaoOcrCandidate[]>([]);
  const [state, setState] = useState<"idle" | "reading" | "confirming">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportTotals | null>(null);
  const readyToConfirm = useMemo(() => file && candidates.length > 0 && candidates.every((candidate) => candidate.trackingNumber.trim() && candidate.pickupCode.trim()), [file, candidates]);

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0] ?? null;
    setFile(selected);
    setCandidates([]);
    setOcrText("");
    setResult(null);
    setError(null);
    setProgress(0);
  }

  async function runLocalOcr() {
    if (!file) return;
    setState("reading");
    setError(null);
    setResult(null);
    setProgress(1);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("chi_sim+eng", 1, {
        logger: (message) => {
          if (typeof message.progress === "number") setProgress(Math.max(1, Math.round(message.progress * 100)));
        },
      });
      const recognition = await worker.recognize(file);
      await worker.terminate();
      const text = recognition.data.text.slice(0, 12_000);
      setOcrText(text);
      setCandidates(extractCainiaoCandidates(text));
      setProgress(100);
    } catch (caught) {
      setError(caught instanceof Error ? `Local OCR could not read this image: ${caught.message}` : "Local OCR could not read this image. Add the parcel details manually instead.");
      setCandidates([]);
    } finally {
      setState("idle");
    }
  }

  function updateCandidate(index: number, field: keyof Omit<CainiaoOcrCandidate, "confidence">, value: string) {
    setCandidates((current) => current.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, [field]: value } : candidate));
  }

  async function confirmImport() {
    if (!file || !readyToConfirm) return;
    setState("confirming");
    setError(null);
    try {
      const formData = new FormData();
      formData.set("screenshot", file);
      formData.set("ocrText", ocrText);
      formData.set("parcels", JSON.stringify(candidates.map(({ confidence: _confidence, ...candidate }) => candidate)));
      const response = await fetch("/api/staff/cainiao-imports/screenshot", { method: "POST", body: formData });
      const payload = (await response.json().catch(() => ({}))) as { data?: { totals: ImportTotals }; error?: { message?: string } };
      if (!response.ok || !payload.data) throw new Error(payload.error?.message ?? "Reviewed screenshot parcels could not be imported.");
      setResult(payload.data.totals);
      setFile(null);
      setCandidates([]);
      setOcrText("");
      if (input.current) input.current.value = "";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Reviewed screenshot parcels could not be imported.");
    } finally {
      setState("idle");
    }
  }

  return (
    <section className="mx-auto mt-8 max-w-5xl border-t border-line pt-8">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-accent-aqua/10 text-info"><ScanText size={23} aria-hidden="true" /></div>
        <div><p className="text-sm font-semibold uppercase tracking-wide text-coral">Screenshot import</p><h3 className="mt-1 text-xl font-semibold text-ink">Read Cainiao pickup details locally</h3><p className="mt-1 text-sm leading-6 text-ink/65">OCR runs in this browser. Review and correct every row before confirmation; nothing is saved while reading.</p></div>
      </div>

      <div className="mt-5 rounded-panel border border-line bg-white p-4 shadow-soft sm:p-6">
        <label className="grid cursor-pointer place-items-center rounded-card border-2 border-dashed border-line bg-paper p-6 text-center hover:border-jade/50">
          <FileImage className="text-jade" size={30} aria-hidden="true" />
          <span className="mt-3 font-semibold">Choose Cainiao screenshot</span>
          <span className="mt-1 text-sm text-ink/60">JPG, PNG, or WebP · maximum 8 MB</span>
          <input ref={input} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={chooseFile} />
        </label>
        {file && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line p-3"><p className="min-w-0 truncate text-sm font-medium">{file.name}</p><Button variant="outline" onClick={() => void runLocalOcr()} loading={state === "reading"} disabled={state !== "idle"}><Upload size={17} aria-hidden="true" /> Run local OCR</Button></div>}
        {state === "reading" && <div className="mt-4"><div className="h-2 overflow-hidden rounded-full bg-paper"><div className="h-full bg-jade transition-all" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-sm text-ink/65">Reading screenshot locally… {progress}%</p></div>}
        {error && <Alert className="mt-4" variant="danger" title="Screenshot import needs attention">{error}</Alert>}
        {result && <Alert className="mt-4" variant={result.unmatched > 0 ? "warning" : "success"} title="Screenshot import saved">{result.matched} matched · {result.unmatched} needs review · {result.inserted} new · {result.refreshed} updated</Alert>}
      </div>

      {(candidates.length > 0 || file) && <section className="mt-5 rounded-panel border border-line bg-white p-4 shadow-soft sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-semibold text-ink">Review before import</h4><p className="mt-1 text-sm text-ink/60">OCR is a suggestion only. Correct fields that are missing or wrong.</p></div><Button variant="outline" size="sm" onClick={() => setCandidates((current) => [...current, emptyCandidate()])} disabled={!file || state !== "idle"}><Plus size={16} aria-hidden="true" /> Add row</Button></div>
        {candidates.length === 0 ? <Alert className="mt-4" variant="info" title="No reliable parcel was found">Add a row manually, or use the manual import form above.</Alert> : <div className="mt-4 space-y-4">{candidates.map((candidate, index) => <ReviewRow key={`${candidate.trackingNumber}-${index}`} candidate={candidate} index={index} onChange={updateCandidate} onRemove={() => setCandidates((current) => current.filter((_, candidateIndex) => candidateIndex !== index))} />)}</div>}
        <div className="mt-5 flex flex-col gap-2 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-ink/55">Confirmation stores the reviewed data and private screenshot evidence. It still does not collect the parcel or complete QC.</p><Button disabled={!readyToConfirm || state !== "idle"} loading={state === "confirming"} onClick={() => void confirmImport()}><CheckCircle2 size={17} aria-hidden="true" /> Confirm import</Button></div>
      </section>}
    </section>
  );
}

function ReviewRow({ candidate, index, onChange, onRemove }: { candidate: CainiaoOcrCandidate; index: number; onChange: (index: number, field: keyof Omit<CainiaoOcrCandidate, "confidence">, value: string) => void; onRemove: () => void }) {
  return <div className="rounded-card border border-line p-3 sm:p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-semibold text-ink">Parcel {index + 1} <span className="ml-1 text-xs font-medium text-ink/55">OCR confidence: {candidate.confidence}</span></p><button type="button" className="focus-ring rounded-control p-2 text-danger hover:bg-danger/10" aria-label={`Remove parcel ${index + 1}`} onClick={onRemove}><Trash2 size={17} /></button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><Input label="Tracking number" required value={candidate.trackingNumber} onChange={(event) => onChange(index, "trackingNumber", event.target.value)} /><Input label="Pickup code" required inputMode="numeric" value={candidate.pickupCode} onChange={(event) => onChange(index, "pickupCode", event.target.value)} /><Input label="Carrier" value={candidate.carrier} onChange={(event) => onChange(index, "carrier", event.target.value)} /><Input label="Station" value={candidate.pickupStation} onChange={(event) => onChange(index, "pickupStation", event.target.value)} /></div><label className="mt-3 block text-sm font-semibold text-foreground">Status<select className="focus-ring mt-1.5 min-h-touch w-full rounded-control border border-border bg-surface px-3 py-2 text-sm" value={candidate.status} onChange={(event) => onChange(index, "status", event.target.value)}><option value="ready_for_pickup">Ready for pickup</option><option value="arriving_soon">Arriving soon</option><option value="in_transit">In transit</option><option value="returned">Returned / exception</option></select></label></div>;
}
