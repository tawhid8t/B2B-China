"use client";

import { CheckCircle2, ClipboardList, FileText, Plus } from "lucide-react";
import Link from "next/link";
import { Alert, Button, Card, PriceDisplay, ProductThumbnail, StatusBadge } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import type { ConfirmOrderResponse } from "@/components/client/product-detail-buying-interface";
import type { OrderStatus } from "@/lib/domain/types";

export function OrderConfirmationResult({
  result,
  product,
  onStartAnother,
}: {
  result: ConfirmOrderResponse;
  product: { title: string; images: string[] };
  onStartAnother: () => void;
}) {
  const submittedAt = result.submittedAt ? new Date(result.submittedAt) : null;
  const status = result.status as OrderStatus | undefined;
  const hasPartialCoverage = (result.uncoveredAmountCny ?? 0) > 0;

  return (
    <section data-page-section="order-confirmation-result" className="mx-auto max-w-3xl space-y-6 pb-28 pt-2 sm:py-5">
      <Card className="overflow-hidden border-action-primary/20 shadow-panel">
        <div className="bg-action-primary px-5 py-7 text-center text-on-action sm:px-8 sm:py-9">
          <CheckCircle2 aria-hidden="true" className="mx-auto h-11 w-11 text-accent-mint" />
          <p className="mt-4 text-xs font-bold uppercase tracking-[0.14em] text-accent-mint">Order submitted</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your product order is confirmed</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/80">Your selections were submitted to the client order workflow. We will show its next operational status in Orders.</p>
        </div>

        <div className="space-y-6 p-5 sm:p-7">
          <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-start gap-4 rounded-card border border-border bg-surface-muted p-4">
            <ProductThumbnail src={product.images[0]} alt={product.title} size="lg" />
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Confirmed product</p>
              <h2 className="mt-1 break-words text-base font-semibold">{product.title}</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {result.orderNumber && <p className="font-mono text-sm font-semibold text-action-primary">{result.orderNumber}</p>}
                {status && <StatusBadge status={status} />}
              </div>
            </div>
          </div>

          <div className="grid gap-4 rounded-card border border-border p-4 text-sm sm:grid-cols-2">
            <ResultField label="Submitted" value={submittedAt ? new Intl.DateTimeFormat("en-BD", { dateStyle: "medium", timeStyle: "short" }).format(submittedAt) : "Confirmed now"} />
            <ResultField label="Authoritative status" value={status ? <StatusBadge status={status} /> : "Confirmed"} />
            <ResultField label="Wallet required" value={<PriceDisplay value={result.requiredAmountCny ?? 0} currency="CNY" showCode size="sm" />} />
            <ResultField label="Wallet reserved" value={<PriceDisplay value={result.reservedAmountCny ?? 0} currency="CNY" showCode size="sm" />} />
            <ResultField label="Remaining supplier payment" value={<PriceDisplay value={result.uncoveredAmountCny ?? 0} currency="CNY" showCode size="sm" />} />
            <ResultField label="Applied exchange rate" value={result.appliedRate ? `1 CNY = ${result.appliedRate.toFixed(4)} BDT` : "Recorded per SKU"} />
          </div>

          {hasPartialCoverage ? (
            <Alert variant="warning" title="Additional supplier payment is required">
              Your available wallet funds were reserved first. The remaining amount is recorded against this product order and will be handled through the existing payment workflow.
            </Alert>
          ) : (
            <Alert variant="success" title="Wallet coverage recorded">
              The confirmed reservation is recorded by the server. Final supplier and logistics costs can still change as the order progresses.
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <Link href="/client/orders" className={buttonClasses({ className: "w-full" })}><ClipboardList aria-hidden="true" className="h-4 w-4" />View orders</Link>
            <Link href="/client/excel-details" className={buttonClasses({ variant: "outline", className: "w-full" })}><FileText aria-hidden="true" className="h-4 w-4" />Product Statement</Link>
            <Button variant="secondary" onClick={onStartAnother} className="w-full"><Plus aria-hidden="true" className="h-4 w-4" />Start another</Button>
          </div>
        </div>
      </Card>
    </section>
  );
}

function ResultField({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{label}</p><div className="mt-1.5 break-words font-semibold text-foreground">{value}</div></div>;
}
