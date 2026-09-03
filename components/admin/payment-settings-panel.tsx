"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, Textarea } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";

type Rate = { id: string; cny_to_bdt: number; source: string; effective_on: string; created_at: string; created_by: string | null };
type Instruction = { id: string; method: string; label: string; account_name: string | null; account_identifier: string | null; instructions: string | null; active: boolean; sort_order: number; created_at: string; updated_at: string };
type Settings = { rates: Rate[]; instructions: Instruction[] };

export function PaymentSettingsPanel({ settings }: { settings: Settings }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "danger"; text: string } | null>(null);
  const todayValue = today();
  const currentRate = settings.rates.find((rate) => rate.effective_on <= todayValue);

  async function submitRate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking("rate"); setMessage(null);
    const form = event.currentTarget; const data = new FormData(form);
    const response = await send("/api/admin/settings/exchange-rates", "POST", { cnyToBdt: data.get("rate"), effectiveOn: data.get("effectiveOn"), source: data.get("source") });
    finish(response, "New exchange rate appended.", () => form.reset());
  }
  async function createInstruction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking("new-instruction"); setMessage(null);
    const form = event.currentTarget;
    const response = await send("/api/admin/settings/payment-instructions", "POST", instructionPayload(new FormData(form)));
    finish(response, "Payment destination created.", () => form.reset());
  }
  async function updateInstruction(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); setWorking(id); setMessage(null);
    const response = await send(`/api/admin/settings/payment-instructions/${id}`, "PATCH", instructionPayload(new FormData(event.currentTarget)));
    finish(response, "Payment destination updated.");
  }
  function finish(result: { ok: boolean; message: string }, success: string, after?: () => void) {
    setWorking(null); setMessage({ type: result.ok ? "success" : "danger", text: result.ok ? success : result.message });
    if (result.ok) { after?.(); router.refresh(); }
  }

  return <div className="space-y-7">
    <div><Link href="/admin/payments" className={buttonClasses({ variant: "ghost", size: "sm" })}>← Back to payment review</Link></div>
    {message && <Alert variant={message.type} title={message.type === "success" ? "Settings updated" : "Update failed"}>{message.text}</Alert>}
    <section className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
      <Card className="p-5"><h2 className="text-lg font-semibold">Append default exchange rate</h2><p className="mt-1 text-sm leading-6 text-muted">Existing rates are immutable. A new row becomes current on its effective date.</p><form className="mt-5 space-y-4" onSubmit={(event) => void submitRate(event)}><Input name="rate" type="number" min="0.0001" step="0.0001" defaultValue={currentRate ? Number(currentRate.cny_to_bdt).toFixed(4) : "19.2000"} label="BDT per 1 CNY" required /><Input name="effectiveOn" type="date" min={todayValue} defaultValue={todayValue} label="Effective date" required /><Input name="source" defaultValue="admin_default" label="Source" required /><Button type="submit" loading={working === "rate"}>Append rate</Button></form></Card>
      <Card className="overflow-hidden"><div className="border-b border-border bg-surface-muted px-5 py-4"><h2 className="text-lg font-semibold">Exchange-rate history</h2></div><div className="max-h-[430px] overflow-auto divide-y divide-border">{settings.rates.map((rate) => <div key={rate.id} className="flex items-start justify-between gap-4 p-4 sm:px-5"><div><p className="font-semibold">1 CNY = {Number(rate.cny_to_bdt).toFixed(4)} BDT</p><p className="mt-1 text-xs text-muted">Effective {formatDate(rate.effective_on)} · {rate.source}</p></div>{rate.id === currentRate?.id && <Badge variant="success">Current</Badge>}</div>)}</div></Card>
    </section>
    <section><div><p className="text-xs font-bold uppercase tracking-wide text-commerce-700">Client-facing destinations</p><h2 className="mt-1 text-xl font-semibold">Payment instructions</h2><p className="mt-1 text-sm text-muted">Only active destinations are shown to clients.</p></div><Card className="mt-4 p-5"><h3 className="font-semibold">Add destination</h3><InstructionForm id="new" working={working === "new-instruction"} onSubmit={createInstruction} /></Card>{settings.instructions.length === 0 ? <EmptyState className="mt-4" title="No payment destinations" description="Add a verified bank or mobile-wallet destination above." /> : <div className="mt-4 grid gap-4 xl:grid-cols-2">{settings.instructions.map((instruction) => <Card key={instruction.id} className="p-5"><div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">{instruction.label}</h3><Badge variant={instruction.active ? "success" : "neutral"}>{instruction.active ? "Active" : "Inactive"}</Badge></div><InstructionForm id={instruction.id} instruction={instruction} working={working === instruction.id} onSubmit={(event) => void updateInstruction(event, instruction.id)} /></Card>)}</div>}</section>
  </div>;
}

function InstructionForm({ id, instruction, working, onSubmit }: { id: string; instruction?: Instruction; working: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <form className="mt-4 space-y-4" onSubmit={onSubmit}><div className="grid gap-4 sm:grid-cols-2"><Input name="method" defaultValue={instruction?.method ?? "bank_transfer"} label="Method" required /><Input name="label" defaultValue={instruction?.label ?? ""} label="Display label" required /><Input name="accountName" defaultValue={instruction?.account_name ?? ""} label="Account name" /><Input name="accountIdentifier" defaultValue={instruction?.account_identifier ?? ""} label="Account number / wallet" /><Input name="sortOrder" type="number" min="0" defaultValue={instruction?.sort_order ?? 0} label="Sort order" /></div><Textarea name="instructions" defaultValue={instruction?.instructions ?? ""} label="Transfer instructions" rows={3} /><label className="flex items-center gap-2 text-sm font-semibold"><input name="active" type="checkbox" defaultChecked={instruction?.active ?? true} /> Active for clients</label><Button type="submit" loading={working}>{id === "new" ? "Add destination" : "Save destination"}</Button></form>;
}

function instructionPayload(data: FormData) { return { method: data.get("method"), label: data.get("label"), accountName: data.get("accountName") || null, accountIdentifier: data.get("accountIdentifier") || null, instructions: data.get("instructions") || null, active: data.get("active") === "on", sortOrder: data.get("sortOrder") }; }
async function send(url: string, method: "POST" | "PATCH", body: unknown) { const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null); const payload = response ? await response.json().catch(() => ({})) : {}; return { ok: Boolean(response?.ok), message: payload.error?.message ?? "The setting could not be saved." }; }
function today() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`)); }
