"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, Card, EmptyState, Input, PriceDisplay, Textarea } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import type { AdminPayment, AdminPaymentPage, PaymentStatus } from "@/services/admin-payment-service";

type Draft = { amount: string; rate: string; reason: string };
type ApiPayload = { data?: { creditedCny?: number }; error?: { message?: string } };

export function AdminPaymentsPanel({ paymentPage }: { paymentPage: AdminPaymentPage }) {
  const router = useRouter();
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const totalPages = Math.max(1, Math.ceil(paymentPage.total / paymentPage.pageSize));

  function draft(payment: AdminPayment): Draft {
    return drafts[payment.id] ?? { amount: payment.claimedAmountBdt.toFixed(2), rate: paymentPage.currentRate.toFixed(4), reason: "" };
  }
  function change(payment: AdminPayment, key: keyof Draft, value: string) {
    setDrafts((current) => ({ ...current, [payment.id]: { ...draft(payment), [key]: value } }));
  }
  async function preview(id: string) {
    setWorking(`${id}:proof`); setError(null);
    const response = await fetch(`/api/admin/payments/${id}/proof`).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) : {};
    if (!response?.ok || !body.data?.signedUrl) setError(body.error?.message ?? "Proof preview could not be created.");
    else window.open(body.data.signedUrl, "_blank", "noopener,noreferrer");
    setWorking(null);
  }
  async function decide(payment: AdminPayment, action: "approve" | "reject" | "needs-review" | "cancel") {
    const values = draft(payment);
    if (action !== "approve" && !values.reason.trim()) { setError("Enter a reason before completing this decision."); return; }
    if (action === "approve" && Number(values.amount) !== payment.claimedAmountBdt && !values.reason.trim()) { setError("Enter a reason because the verified amount differs from the claimed amount."); return; }
    setWorking(`${payment.id}:${action}`); setError(null); setSuccess(null);
    const payload = action === "approve"
      ? { verifiedAmountBdt: Number(values.amount), cnyToBdtRate: Number(values.rate), reason: values.reason || undefined }
      : { reason: values.reason };
    const response = await fetch(`/api/admin/payments/${payment.id}/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    const body = response ? await response.json().catch(() => ({})) as ApiPayload : {};
    if (!response?.ok) setError(body.error?.message ?? "Payment decision could not be saved.");
    else { setSuccess(action === "approve" ? `Payment approved and CNY ${Number(body.data?.creditedCny ?? 0).toFixed(2)} credited.` : `Payment marked ${action.replace("-", " ")}.`); router.refresh(); }
    setWorking(null);
  }

  return <div className="space-y-5">
    <Card className="p-4 sm:p-5">
      <form className="grid gap-3 md:grid-cols-[1fr_220px_auto]" method="get">
        <Input name="search" label="Client business" defaultValue={paymentPage.search} placeholder="Search client" />
        <label className="text-sm font-semibold">Status<select name="status" defaultValue={paymentPage.status} className="mt-1.5 min-h-touch-lg w-full rounded-control border border-border bg-surface px-3 text-sm"><option value="all">All statuses</option>{["pending","needs_review","approved","rejected","cancelled"].map((status) => <option key={status} value={status}>{labelStatus(status as PaymentStatus)}</option>)}</select></label>
        <Button type="submit" className="self-end">Filter</Button>
      </form>
    </Card>
    {error && <Alert variant="danger" title="Action failed">{error}</Alert>}
    {success && <Alert variant="success" title="Payment updated">{success}</Alert>}
    <div className="flex items-center justify-between"><p className="text-sm text-muted">{paymentPage.total} payment proof{paymentPage.total === 1 ? "" : "s"}</p><p className="text-sm font-semibold">Current default: 1 CNY = {paymentPage.currentRate.toFixed(4)} BDT</p></div>
    {!paymentPage.payments.length ? <EmptyState title="No payment proofs found" description="No submissions match the selected queue and client filter." /> : <div className="space-y-4">{paymentPage.payments.map((payment) => {
      const values = draft(payment); const reviewable = payment.status === "pending" || payment.status === "needs_review";
      return <Card key={payment.id} className="overflow-hidden"><div className="border-b border-border bg-surface-muted p-4 sm:px-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">{payment.clientName}</h2><PaymentBadge status={payment.status} /></div><p className="mt-1 text-xs text-muted">{payment.clientContact || payment.clientId} · submitted {formatDateTime(payment.createdAt)}</p></div><Button variant="outline" size="sm" loading={working === `${payment.id}:proof`} onClick={() => void preview(payment.id)}>Preview private proof</Button></div></div><div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[0.75fr_1.25fr]"><div className="space-y-2 text-sm"><p><span className="text-muted">Claimed:</span> <PriceDisplay value={payment.claimedAmountBdt} currency="BDT" showCode size="sm" /></p><p><span className="text-muted">Paid:</span> {formatDate(payment.paidAt)}</p>{payment.approvedAmountBdt !== null && <p><span className="text-muted">Verified:</span> BDT {payment.approvedAmountBdt.toFixed(2)}</p>}{payment.notes && <p className="leading-6 text-muted">Client note: {payment.notes}</p>}{(payment.reviewReason || payment.rejectionReason) && <p className="leading-6 text-muted">Review reason: {payment.reviewReason || payment.rejectionReason}</p>}{payment.reviewedAt && <p className="text-xs text-muted">Reviewed {formatDateTime(payment.reviewedAt)}{payment.reviewerName ? ` by ${payment.reviewerName}` : ""}</p>}</div>{reviewable ? <div className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Input type="number" min="0.01" step="0.01" label="Verified amount (BDT)" value={values.amount} onChange={(event) => change(payment, "amount", event.target.value)} /><Input type="number" min="0.0001" step="0.0001" label="Exchange rate (BDT/CNY)" value={values.rate} onChange={(event) => change(payment, "rate", event.target.value)} /></div><Textarea label="Review or mismatch reason" rows={2} value={values.reason} onChange={(event) => change(payment, "reason", event.target.value)} /><div className="flex flex-wrap gap-2"><Button size="sm" loading={working === `${payment.id}:approve`} onClick={() => void decide(payment, "approve")}>Approve & credit</Button><Button variant="secondary" size="sm" loading={working === `${payment.id}:needs-review`} onClick={() => void decide(payment, "needs-review")}>Needs review</Button><Button variant="danger" size="sm" loading={working === `${payment.id}:reject`} onClick={() => void decide(payment, "reject")}>Reject</Button><Button variant="ghost" size="sm" loading={working === `${payment.id}:cancel`} onClick={() => void decide(payment, "cancel")}>Cancel</Button></div></div> : <div className="rounded-control border border-border bg-surface-muted p-4 text-sm text-muted">This review is complete. Historical decisions and proof evidence are read-only.</div>}</div></Card>;
    })}</div>}
    {totalPages > 1 && <nav className="flex justify-end gap-2"><Link className={buttonClasses({ variant: "outline", size: "sm", className: paymentPage.page <= 1 ? "pointer-events-none opacity-50" : "" })} href={pageHref(paymentPage, paymentPage.page - 1)}>Previous</Link><span className="px-2 py-2 text-sm text-muted">Page {paymentPage.page} of {totalPages}</span><Link className={buttonClasses({ variant: "outline", size: "sm", className: paymentPage.page >= totalPages ? "pointer-events-none opacity-50" : "" })} href={pageHref(paymentPage, paymentPage.page + 1)}>Next</Link></nav>}
  </div>;
}

function PaymentBadge({ status }: { status: PaymentStatus }) { const variant = status === "approved" ? "success" : status === "rejected" ? "danger" : status === "needs_review" ? "warning" : "neutral"; return <Badge variant={variant}>{labelStatus(status)}</Badge>; }
function labelStatus(status: PaymentStatus) { return status.replace("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium" }).format(new Date(`${value}T00:00:00Z`)); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
function pageHref(page: AdminPaymentPage, value: number) { const query = new URLSearchParams({ page: String(Math.max(1, value)) }); if (page.status !== "all") query.set("status", page.status); if (page.search) query.set("search", page.search); return `/admin/payments?${query}`; }
