"use client";

import {
  Banknote,
  CalendarDays,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileUp,
  Download,
  Landmark,
  ShieldCheck,
  WalletCards,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, PageHeader, PriceDisplay, Select, Textarea } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import type {
  ClientPaymentInstruction,
  ClientPaymentProof,
  ClientWalletOverview,
} from "@/services/client-wallet-service";
import type { WalletStatement, WalletTransaction } from "@/services/wallet-statement-service";

type ApiErrorPayload = { error?: { message?: string; details?: unknown } };

export function ClientWallet({ overview }: { overview: ClientWalletOverview }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submitProof(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setSuccess(null);
    setError(null);

    const form = event.currentTarget;
    const response = await fetch("/api/payments/proof", {
      method: "POST",
      body: new FormData(form),
    }).catch(() => null);

    if (!response) {
      setError("The payment proof could not be submitted. Check your connection and try again.");
      setSubmitting(false);
      return;
    }

    const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;
    if (!response.ok) {
      setError(payload.error?.message || "The payment proof could not be submitted.");
      setSubmitting(false);
      return;
    }

    form.reset();
    if (fileInputRef.current) fileInputRef.current.value = "";
    setSuccess("Payment proof submitted. It is pending admin verification and has not credited your wallet yet.");
    setSubmitting(false);
    router.refresh();
  }

  async function cancelProof(paymentProofId: string) {
    if (!window.confirm("Cancel this pending payment proof? It will remain in your history and cannot be submitted for review again.")) return;
    setCancellingId(paymentProofId);
    setSuccess(null);
    setError(null);
    const response = await fetch(`/api/payments/${paymentProofId}/cancel`, { method: "POST" }).catch(() => null);
    const payload = response ? ((await response.json().catch(() => ({}))) as ApiErrorPayload) : {};
    if (!response?.ok) {
      setError(payload.error?.message || "The payment proof could not be cancelled.");
    } else {
      setSuccess("Pending payment proof cancelled. No wallet credit was created.");
      router.refresh();
    }
    setCancellingId(null);
  }

  return (
    <>
      <PageHeader
        eyebrow="Wallet & payments"
        title="Your wallet"
        description="Wallet funds are held in CNY. Submit BDT transfer proof here and wait for admin verification before credit is added."
      />

      <section className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Wallet summary">
        <SummaryCard icon={WalletCards} label="Available balance" value={overview.totals.availableBalanceCny} detail="Ready for new reservations" emphasized />
        <SummaryCard icon={Clock3} label="Reserved" value={overview.totals.activeReservedCny} detail="Held for accepted orders" />
        <SummaryCard icon={Banknote} label="Total funds" value={overview.totals.totalFundsCny} detail="Before active reservations" />
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Current default rate</p>
              <p className="mt-3 text-xl font-semibold tabular-nums text-foreground">1 CNY = {formatRate(overview.exchangeRate.cnyToBdt)} BDT</p>
              <p className="mt-2 text-xs leading-5 text-muted">Effective {formatDate(overview.exchangeRate.effectiveOn)}. Approved deposits keep their recorded rate.</p>
            </div>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-warning/10 text-action-primary"><Landmark aria-hidden="true" className="h-5 w-5" /></span>
          </div>
        </Card>
      </section>

      {(success || error) && <div className="mt-5">{success ? <Alert variant="success" title="Request updated">{success}</Alert> : <Alert variant="danger" title="Action not completed">{error}</Alert>}</div>}

      <div className="mt-7 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <section className="space-y-5" aria-labelledby="payment-destinations-title">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Payment destinations</p>
            <h2 id="payment-destinations-title" className="mt-1 text-xl font-semibold">Transfer before submitting proof</h2>
          </div>
          {overview.paymentInstructions.length === 0 ? (
            <EmptyState title="Payment instructions unavailable" description="Contact support before making a transfer. Do not submit payment to an unverified destination." icon={<Landmark aria-hidden="true" className="h-5 w-5" />} />
          ) : (
            <div className="space-y-3">
              {overview.paymentInstructions.map((instruction) => <PaymentInstruction key={instruction.id} instruction={instruction} />)}
            </div>
          )}
          <Alert variant="warning" title="Approval is required">Uploading proof does not increase your wallet balance. Credit is created only after an admin verifies the transfer and exchange rate.</Alert>
        </section>

        <Card className="overflow-hidden shadow-panel">
          <div className="border-b border-border bg-surface-muted px-5 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-control bg-action-primary text-on-action"><FileUp aria-hidden="true" className="h-5 w-5" /></span>
              <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-action-primary">Add funds</p><h2 className="mt-0.5 text-lg font-semibold">Submit payment proof</h2></div>
            </div>
          </div>
          <form onSubmit={(event) => void submitProof(event)} className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input name="amountBdt" type="number" min="0.01" max="99999999.99" step="0.01" label="Transferred amount (BDT)" placeholder="50000.00" required />
              <Input name="paidAt" type="date" max={todayForInput()} defaultValue={todayForInput()} label="Payment date" required />
            </div>
            <Input ref={fileInputRef} name="proof" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" label="Proof image or PDF" hint="JPG, PNG, WebP, or PDF. Maximum 10 MB." required />
            <Textarea name="notes" label="Note (optional)" placeholder="Transfer reference or other details for the reviewer" maxLength={1000} rows={3} />
            <Button type="submit" size="lg" loading={submitting} className="w-full sm:w-auto"><FileUp aria-hidden="true" className="h-4 w-4" />Submit for verification</Button>
          </form>
        </Card>
      </div>

      <PaymentHistory
        proofs={overview.paymentHistory.proofs}
        total={overview.paymentHistory.total}
        page={overview.paymentHistory.page}
        pageSize={overview.paymentHistory.pageSize}
        cancellingId={cancellingId}
        onCancel={cancelProof}
      />
      <WalletStatementSection statement={overview.walletStatement} />
    </>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, emphasized = false }: { icon: typeof WalletCards; label: string; value: number; detail: string; emphasized?: boolean }) {
  return <Card className={emphasized ? "!border-accent-mint/40 !bg-action-primary p-5 text-on-action" : "p-5"}><div className="flex items-start justify-between gap-3"><div><p className={emphasized ? "text-xs font-bold uppercase tracking-[0.1em] text-accent-mint" : "text-xs font-bold uppercase tracking-[0.1em] text-muted"}>{label}</p><PriceDisplay value={value} currency="CNY" showCode size="xl" className={emphasized ? "mt-2 !text-on-action [&_span]:!text-on-action/70" : "mt-2"} /><p className={emphasized ? "mt-2 text-xs text-on-action/60" : "mt-2 text-xs text-muted"}>{detail}</p></div><span className={emphasized ? "grid h-10 w-10 place-items-center rounded-control bg-white/10 text-accent-mint" : "grid h-10 w-10 place-items-center rounded-control bg-action-soft text-action-primary"}><Icon aria-hidden="true" className="h-5 w-5" /></span></div></Card>;
}

function PaymentInstruction({ instruction }: { instruction: ClientPaymentInstruction }) {
  return <Card className="p-4 sm:p-5"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-control bg-action-soft text-action-primary"><Landmark aria-hidden="true" className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{instruction.label}</h3><Badge variant="neutral">{humanize(instruction.method)}</Badge></div>{instruction.accountName && <p className="mt-2 text-sm text-muted">Account name: <span className="font-semibold text-foreground">{instruction.accountName}</span></p>}{instruction.accountIdentifier && <p className="mt-1 break-all font-mono text-sm font-semibold text-foreground">{instruction.accountIdentifier}</p>}{instruction.instructions && <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">{instruction.instructions}</p>}</div></div></Card>;
}

function PaymentHistory({ proofs, total, page, pageSize, cancellingId, onCancel }: { proofs: ClientPaymentProof[]; total: number; page: number; pageSize: number; cancellingId: string | null; onCancel: (id: string) => Promise<void> }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return <section className="mt-9" aria-labelledby="payment-history-title"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Payment history</p><h2 id="payment-history-title" className="mt-1 text-xl font-semibold">Submitted proofs</h2></div><div className="flex items-center gap-3"><p className="text-sm text-muted">{total} submission{total === 1 ? "" : "s"}</p><a href="/api/payments/export" className={buttonClasses({ variant: "outline", size: "sm" })}><Download aria-hidden="true" className="h-4 w-4" />Export CSV</a></div></div>{proofs.length === 0 ? <EmptyState className="mt-4" title="No payment proofs yet" description="After you transfer money, submit the proof above. Its review status will appear here." icon={<FileCheck2 aria-hidden="true" className="h-5 w-5" />} /> : <div className="mt-4 space-y-3">{proofs.map((proof) => <PaymentProofCard key={proof.id} proof={proof} cancelling={cancellingId === proof.id} onCancel={onCancel} />)}</div>}{totalPages > 1 && <nav aria-label="Payment history pages" className="mt-5 flex items-center justify-end gap-2"><Link aria-disabled={page <= 1} tabIndex={page <= 1 ? -1 : undefined} href={`/client/wallet?paymentsPage=${Math.max(1, page - 1)}`} className={buttonClasses({ variant: "outline", size: "sm", className: page <= 1 ? "pointer-events-none opacity-50" : "" })}>Previous</Link><span className="px-2 text-sm text-muted">Page {page} of {totalPages}</span><Link aria-disabled={page >= totalPages} tabIndex={page >= totalPages ? -1 : undefined} href={`/client/wallet?paymentsPage=${Math.min(totalPages, page + 1)}`} className={buttonClasses({ variant: "outline", size: "sm", className: page >= totalPages ? "pointer-events-none opacity-50" : "" })}>Next</Link></nav>}</section>;
}

function WalletStatementSection({ statement }: { statement: WalletStatement }) {
  const pages = Math.max(1, Math.ceil(statement.meta.total / statement.meta.pageSize));
  return <section className="mt-10" aria-labelledby="wallet-statement-title"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Wallet ledger</p><h2 id="wallet-statement-title" className="mt-1 text-xl font-semibold">Transaction statement</h2><p className="mt-1 text-sm text-muted">Every credit, reservation, debit, refund, and correction is shown with its recorded rate and running available balance.</p></div><Card className="mt-4 p-4 sm:p-5"><form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"><Select name="type" defaultValue={statement.filters.type ?? ""} label="Transaction type"><option value="">All types</option>{["advance_credit","order_debit","refund","adjustment","reservation","reservation_release"].map((type) => <option key={type} value={type}>{humanize(type)}</option>)}</Select><Input name="from" type="date" label="From date" defaultValue={statement.filters.from ?? ""} /><Input name="to" type="date" label="To date" defaultValue={statement.filters.to ?? ""} /><Button type="submit" className="self-end">Apply filters</Button></form></Card>{statement.transactions.length === 0 ? <EmptyState className="mt-4" title="No wallet transactions" description="No transactions match the selected statement filters." /> : <div className="mt-4 space-y-3">{statement.transactions.map((transaction) => <WalletTransactionCard key={transaction.id} transaction={transaction} />)}</div>}{pages > 1 && <nav className="mt-5 flex justify-end gap-2"><Link href={walletPageHref(statement, statement.meta.page - 1)} className={buttonClasses({ variant: "outline", size: "sm", className: statement.meta.page <= 1 ? "pointer-events-none opacity-50" : "" })}>Previous</Link><span className="px-2 py-2 text-sm text-muted">Page {statement.meta.page} of {pages}</span><Link href={walletPageHref(statement, statement.meta.page + 1)} className={buttonClasses({ variant: "outline", size: "sm", className: statement.meta.page >= pages ? "pointer-events-none opacity-50" : "" })}>Next</Link></nav>}</section>;
}

function WalletTransactionCard({ transaction }: { transaction: WalletTransaction }) {
  const positive = transaction.amountCny > 0;
  return <Card className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><Badge variant={positive ? "success" : "neutral"}>{humanize(transaction.type)}</Badge><PriceDisplay value={transaction.amountCny} currency="CNY" showCode /></div><p className="mt-2 text-xs text-muted">{formatDateTime(transaction.createdAt)} · rate {formatRate(transaction.cnyToBdtRate)} BDT/CNY · BDT {transaction.amountBdt.toFixed(2)}</p>{transaction.paymentProof && <p className="mt-2 text-sm text-muted">Payment proof <span className="font-mono">{transaction.paymentProof.id.slice(0, 8)}</span> · {transaction.paymentProof.status}</p>}{transaction.order && <p className="mt-1 text-sm text-muted">Order <span className="font-mono">{transaction.order.id.slice(0, 8)}</span>{transaction.order.productTitle ? ` · ${transaction.order.productTitle}` : ""}</p>}{transaction.correctsTransactionId && <p className="mt-1 text-sm text-muted">Corrects transaction <span className="font-mono">{transaction.correctsTransactionId.slice(0, 8)}</span></p>}{transaction.reason && <p className="mt-2 text-sm leading-6 text-muted">Reason: {transaction.reason}</p>}{transaction.actor && <p className="mt-1 text-xs text-muted">Actor: {transaction.actor.name || transaction.actor.id}</p>}</div><div className="sm:text-right"><p className="text-xs uppercase tracking-wide text-muted">Running available</p><PriceDisplay value={transaction.runningAvailableBalanceCny} currency="CNY" showCode size="sm" className="mt-1" />{transaction.cumulativeCorrectedCny > 0 && <p className="mt-2 text-xs text-muted">Corrected CNY {transaction.cumulativeCorrectedCny.toFixed(2)}</p>}</div></div></Card>;
}

function walletPageHref(statement: WalletStatement, page: number) { const query = new URLSearchParams({ ledgerPage: String(Math.max(1, page)) }); if (statement.filters.type) query.set("type", statement.filters.type); if (statement.filters.from) query.set("from", statement.filters.from); if (statement.filters.to) query.set("to", statement.filters.to); return `/client/wallet?${query}`; }

function PaymentProofCard({ proof, cancelling, onCancel }: { proof: ClientPaymentProof; cancelling: boolean; onCancel: (id: string) => Promise<void> }) {
  const status = paymentStatus(proof.status);
  const StatusIcon = status.icon;
  const reason = proof.rejectionReason || proof.reviewReason;
  return <Card className="p-4 sm:p-5"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div className="flex min-w-0 gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-surface-muted text-muted"><StatusIcon aria-hidden="true" className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><PriceDisplay value={proof.claimedAmountBdt} currency="BDT" showCode /><Badge variant={status.variant}>{status.label}</Badge></div><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted"><span className="inline-flex items-center gap-1"><CalendarDays aria-hidden="true" className="h-3.5 w-3.5" />Paid {formatDate(proof.paidAt)}</span><span>Submitted {formatDateTime(proof.createdAt)}</span></div>{proof.approvedAmountBdt !== null && proof.approvedAmountBdt !== proof.claimedAmountBdt && <p className="mt-2 text-sm">Verified amount: <PriceDisplay value={proof.approvedAmountBdt} currency="BDT" showCode size="sm" /></p>}{proof.notes && <p className="mt-2 text-sm leading-6 text-muted">Your note: {proof.notes}</p>}{reason && <p className="mt-2 text-sm leading-6 text-muted">Review note: {reason}</p>}</div></div>{proof.status === "pending" && <Button variant="ghost" size="sm" loading={cancelling} onClick={() => void onCancel(proof.id)}><XCircle aria-hidden="true" className="h-4 w-4" />Cancel proof</Button>}</div></Card>;
}

function paymentStatus(status: ClientPaymentProof["status"]) {
  if (status === "approved") return { label: "Approved", variant: "success" as const, icon: CheckCircle2 };
  if (status === "rejected") return { label: "Rejected", variant: "danger" as const, icon: XCircle };
  if (status === "needs_review") return { label: "Needs review", variant: "warning" as const, icon: ShieldCheck };
  if (status === "cancelled") return { label: "Cancelled", variant: "neutral" as const, icon: XCircle };
  return { label: "Pending", variant: "warning" as const, icon: Clock3 };
}

function formatDate(value: string) { return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function formatRate(value: number) { return new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(value); }
function humanize(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
function todayForInput() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const values = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; }
