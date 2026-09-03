"use client";

/* eslint-disable @next/next/no-img-element -- supplier image hosts are dynamic. */
import { CheckCircle2, Clock3, ImageOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Card, Input, PriceDisplay } from "@/components/ui";

export type EstimateReviewBreakdown = {
  unitPriceCny: number;
  quantity: number;
  productSubtotalCny: number;
  domesticDeliveryCny: number;
  exchangeRateCnyToBdt: number;
  productSubtotalBdt: number;
  estimatedTotalWeightKg: number;
  categoryShippingBdt: number;
  chinaToGuangzhouBdt: number;
  profitBdt: number;
  totalBdt: number;
};

export type EstimateForReview = {
  estimateId: string;
  validUntil: string;
  breakdown: EstimateReviewBreakdown;
};

type ReviewSku = {
  skuId: string;
  label: string;
  attributes: Record<string, string>;
  imageUrl?: string;
};
type ApiError = { code?: string; message?: string };
type AcceptedOrder = {
  orderItemId?: string;
  groupId?: string | null;
  groupCode?: string | null;
  status?: string;
  walletReservationStatus?: string;
  requiredAmountCny?: number;
  reservedAmountCny?: number;
  uncoveredAmountCny?: number;
  walletBalanceCny?: number;
};

export function EstimateReview({
  product,
  sku,
  estimate,
  clientId,
  onEdit,
}: {
  product: { title: string; images: string[] };
  sku: ReviewSku;
  estimate: EstimateForReview;
  clientId: string;
  onEdit: () => void;
}) {
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accepted, setAccepted] = useState<AcceptedOrder | null>(null);
  const [walletWarning, setWalletWarning] = useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [rejected, setRejected] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const acceptInFlight = useRef(false);
  const rejectInFlight = useRef(false);
  const expired = useMemo(
    () => new Date(estimate.validUntil).getTime() <= Date.now(),
    [estimate.validUntil],
  );
  const sourceProductImage = sku.imageUrl ?? product.images[0];
  const productImage = imageFailed ? undefined : sourceProductImage;

  useEffect(() => {
    setImageFailed(false);
  }, [sourceProductImage]);

  useEffect(() => {
    if (!sourceProductImage) return;

    function handleImageError(event: Event) {
      const target = event.target;
      if (!(target instanceof HTMLImageElement)) return;
      if (
        target.currentSrc === sourceProductImage ||
        target.getAttribute("src") === sourceProductImage
      )
        setImageFailed(true);
    }

    window.addEventListener("error", handleImageError, true);
    return () => window.removeEventListener("error", handleImageError, true);
  }, [sourceProductImage]);

  async function accept() {
    if (acceptInFlight.current) return;
    if (expired) {
      setError(
        "This estimate has expired. Return to the selection to request a new estimate.",
      );
      return;
    }
    acceptInFlight.current = true;
    setError(null);
    setWalletWarning(null);
    setAccepting(true);
    try {
      const response = await fetch(
        `/api/estimates/${estimate.estimateId}/accept`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: AcceptedOrder;
        error?: ApiError;
        meta?: { warnings?: Array<{ code?: string; message?: string }> };
      };
      if (!response.ok || !payload.data) {
        setError(actionError(payload.error, "accept"));
        return;
      }
      setAccepted(payload.data);
      const warning = payload.meta?.warnings?.find(
        (item) => item.code === "INSUFFICIENT_WALLET_BALANCE",
      );
      if (warning?.message) setWalletWarning(warning.message);
    } catch {
      setError(
        "Network connection failed. Your estimate has not been accepted; please try again when you are connected.",
      );
    } finally {
      acceptInFlight.current = false;
      setAccepting(false);
    }
  }

  async function reject() {
    if (rejectInFlight.current) return;
    if (!reason.trim()) {
      setError("Tell us why you are rejecting this estimate.");
      return;
    }
    rejectInFlight.current = true;
    setError(null);
    setRejecting(true);
    try {
      const response = await fetch(
        `/api/estimates/${estimate.estimateId}/reject`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { estimateId?: string; status?: string };
        error?: ApiError;
      };
      if (!response.ok || !payload.data) {
        setError(actionError(payload.error, "reject"));
        return;
      }
      setRejected(true);
    } catch {
      setError(
        "Network connection failed. Your estimate has not been rejected; please try again when you are connected.",
      );
    } finally {
      rejectInFlight.current = false;
      setRejecting(false);
    }
  }

  if (accepted)
    return (
      <Outcome
        title="Estimate accepted"
        detail="Your order has been created and is pending admin review."
        onEdit={onEdit}
      >
        <dl className="mt-5 space-y-3 rounded-card border border-action-primary/20 bg-action-soft p-4 text-sm">
          <Detail label="Order item" value={accepted.orderItemId} />
          <Detail
            label="Status"
            value={humanizeStatus(accepted.status ?? "pending_admin_review")}
          />
          <Detail
            label="Wallet reservation"
            value={humanizeStatus(
              accepted.walletReservationStatus ?? "reserved_or_partial",
            )}
          />
          <Detail
            label="Required supplier cost"
            value={`CNY ${Number(accepted.requiredAmountCny ?? 0).toFixed(2)}`}
          />
          <Detail
            label="Reserved from wallet"
            value={`CNY ${Number(accepted.reservedAmountCny ?? 0).toFixed(2)}`}
          />
          <Detail
            label="Uncovered amount"
            value={`CNY ${Number(accepted.uncoveredAmountCny ?? 0).toFixed(2)}`}
          />
          <Detail
            label="Applied estimate rate"
            value={`${estimate.breakdown.exchangeRateCnyToBdt.toFixed(4)} BDT/CNY`}
          />
        </dl>
        {walletWarning && (
          <Alert variant="warning" title="Wallet balance notice">
            {walletWarning}
          </Alert>
        )}
      </Outcome>
    );
  if (rejected)
    return (
      <Outcome
        title="Estimate rejected"
        detail="This estimate will remain in your history and will not proceed to purchasing."
        onEdit={onEdit}
      />
    );

  return (
    <main className="mx-auto max-w-6xl pb-28 sm:pb-8">
      <div className="mb-6 flex items-start gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">
            Estimate review
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Review your estimated cost
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            This is a planning estimate, not a final supplier payment.
          </p>
        </div>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="flex gap-4">
              <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-control bg-surface-muted">
                {productImage ? (
                  <img
                    src={productImage}
                    alt=""
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <ImageOff aria-hidden="true" className="h-5 w-5 text-muted" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                  Selected product
                </p>
                <h2 className="mt-1 break-words text-base font-semibold">
                  {product.title}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  {skuLabel(sku)} · Quantity {estimate.breakdown.quantity}
                </p>
              </div>
            </div>
          </Card>
          <CostBreakdown estimate={estimate} />
        </section>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-action-primary/20 shadow-panel">
            <div className="bg-action-primary p-5 text-on-action">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-mint">
                Estimated cost
              </p>
              <p className="mt-2 text-sm text-white/70">
                Final estimated total
              </p>
              <PriceDisplay
                value={estimate.breakdown.totalBdt}
                currency="BDT"
                showCode
                size="xl"
                className="mt-1 text-white [&_span]:text-white/70"
              />
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start gap-2 text-sm leading-6 text-muted">
                <Clock3
                  aria-hidden="true"
                  className="mt-0.5 h-4 w-4 shrink-0 text-action-primary"
                />
                <span>
                  {expired
                    ? "This estimate has expired."
                    : `Valid until ${formatDate(estimate.validUntil)}.`}
                </span>
              </div>
              <Alert variant="warning" title="Estimated cost">
                Actual cost may change after actual weight, seller payment, and
                courier cost are known.
              </Alert>
              {error && (
                <Alert variant="danger" title="Action not completed">
                  {error}
                </Alert>
              )}
              {rejectOpen && (
                <div className="space-y-3 rounded-card border border-border p-3">
                  <Input
                    id="estimate-rejection-reason"
                    label="Reason for rejecting"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    maxLength={2000}
                    required
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRejectOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={rejecting}
                      onClick={() => void reject()}
                    >
                      Confirm rejection
                    </Button>
                  </div>
                </div>
              )}
              <div className="hidden lg:grid gap-2">
                <Button
                  size="lg"
                  loading={accepting}
                  disabled={expired || accepting || rejecting}
                  onClick={() => void accept()}
                >
                  Accept Estimate
                </Button>
                <Button variant="outline" onClick={onEdit}>
                  Back to edit selection
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setRejectOpen((open) => !open)}
                >
                  Reject estimate
                </Button>
              </div>
            </div>
          </Card>
        </aside>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-surface p-3 shadow-[0_-8px_24px_rgba(9,52,37,0.12)] safe-area-bottom lg:hidden">
        <div className="mx-auto flex max-w-lg gap-2">
          <Button
            variant="outline"
            size="lg"
            onClick={onEdit}
            className="flex-1"
          >
            Edit
          </Button>
          <Button
            size="lg"
            loading={accepting}
            disabled={expired || accepting || rejecting}
            onClick={() => void accept()}
            className="flex-1"
          >
            Accept Estimate
          </Button>
        </div>
        {!rejectOpen && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRejectOpen(true)}
            className="mx-auto mt-1 flex"
          >
            Reject estimate
          </Button>
        )}
      </div>
    </main>
  );
}

function CostBreakdown({ estimate }: { estimate: EstimateForReview }) {
  const { breakdown } = estimate;
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">
        Cost breakdown
      </p>
      <dl className="mt-4 space-y-4 text-sm">
        <Cost
          label="Supplier product cost"
          value={
            <PriceDisplay
              value={breakdown.productSubtotalCny}
              currency="CNY"
              showCode
              size="sm"
            />
          }
          detail={`${formatCny(breakdown.unitPriceCny)} × ${breakdown.quantity}`}
        />
        <Cost
          label="China domestic delivery"
          value={
            <PriceDisplay
              value={breakdown.domesticDeliveryCny}
              currency="CNY"
              showCode
              size="sm"
            />
          }
        />
        <Cost
          label="CNY to BDT product cost"
          value={
            <PriceDisplay
              value={breakdown.productSubtotalBdt}
              currency="BDT"
              showCode
              size="sm"
            />
          }
          detail={`Rate used: 1 CNY = ${breakdown.exchangeRateCnyToBdt} BDT`}
        />
        <Cost
          label="Estimated product weight"
          value={`${breakdown.estimatedTotalWeightKg} kg`}
        />
        <Cost
          label="Estimated international shipping"
          value={
            <PriceDisplay
              value={breakdown.categoryShippingBdt}
              currency="BDT"
              showCode
              size="sm"
            />
          }
        />
        <Cost
          label="China to Guangzhou"
          value={
            <PriceDisplay
              value={breakdown.chinaToGuangzhouBdt}
              currency="BDT"
              showCode
              size="sm"
            />
          }
        />
        <Cost
          label="Service and handling"
          value={
            <PriceDisplay
              value={breakdown.profitBdt}
              currency="BDT"
              showCode
              size="sm"
            />
          }
        />
        <div className="border-t border-border pt-4">
          <Cost
            label="Estimated total"
            value={
              <PriceDisplay
                value={breakdown.totalBdt}
                currency="BDT"
                showCode
                size="lg"
              />
            }
            strong
          />
        </div>
      </dl>
    </Card>
  );
}
function Cost({
  label,
  value,
  detail,
  strong = false,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <dt className={strong ? "font-semibold" : "text-muted"}>{label}</dt>
        {detail && <p className="mt-1 text-xs text-muted">{detail}</p>}
      </div>
      <dd className={strong ? "font-semibold" : "text-right font-semibold"}>
        {value}
      </dd>
    </div>
  );
}
function Outcome({
  title,
  detail,
  children,
  onEdit,
}: {
  title: string;
  detail: string;
  children?: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <main className="mx-auto max-w-lg py-8">
      <Card className="space-y-4 p-6 text-center">
        <CheckCircle2
          aria-hidden="true"
          className="mx-auto h-10 w-10 text-action-primary"
        />
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm leading-6 text-muted">{detail}</p>
        {children}
        <Button variant="outline" onClick={onEdit} className="w-full">
          Back to product selection
        </Button>
      </Card>
    </main>
  );
}
function Detail({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="break-all text-right font-semibold">
        {value ?? "Not available"}
      </dd>
    </div>
  );
}
function skuLabel(sku: ReviewSku) {
  const values = Object.values(sku.attributes);
  return values.length ? values.join(" / ") : sku.label;
}
function formatCny(value: number) {
  return new Intl.NumberFormat("zh-CN", {
    style: "currency",
    currency: "CNY",
    currencyDisplay: "code",
  }).format(value);
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
function humanizeStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
function actionError(error: ApiError | undefined, action: "accept" | "reject") {
  if (error?.code === "EXPIRED_ESTIMATE")
    return "This estimate has expired. Return to the selection to request a new estimate.";
  if (error?.code === "INSUFFICIENT_WALLET_BALANCE")
    return "Your wallet balance is insufficient for this action. Please contact support or add funds before continuing.";
  if (error?.code === "CONFLICT")
    return `This estimate cannot be ${action}ed because it was already processed or is no longer available.`;
  if (error?.code === "MANUAL_REVIEW_REQUIRED")
    return "This estimate requires manual review before it can continue.";
  return (
    error?.message ||
    `We could not ${action} this estimate. No action was retried.`
  );
}
