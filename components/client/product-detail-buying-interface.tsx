"use client";

/* eslint-disable @next/next/no-img-element -- supplier image hosts are dynamic. */
import { ImageOff, Package, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Input,
  PriceDisplay,
  ProductThumbnail,
  QuantityStepper,
} from "@/components/ui";
import { ShippingTariffSelector } from "@/components/client/shipping-tariff-selector";
import type { ResolvedProduct } from "@/components/client/product-link-entry";
import { type ShippingTariffItem } from "@/lib/shipping-tariffs";
import {
  getDisplayVariantLabel,
  getMatchingVariantSkus,
  getResolvedVariantSku,
  getVariantAttributeGroups,
  getVariantOptionState,
  translateVariantAttributeName,
  translateVariantValue,
} from "@/lib/product-variant-selection";
import {
  clearProductSkuSelection,
  getSelectedSkuLines,
  getSupplierSelectionSummary,
  setSelectionFilter,
  setSkuSelectionQuantity,
  type ProductSkuSelectionState,
  type SelectedSkuLine,
  type SupplierSelectionSummary,
} from "@/lib/product-sku-selection";
import { cn } from "@/lib/ui/cn";
import { calculateLogisticsEstimate } from "@/services/estimate-calculation-service";

type ProductSku = ResolvedProduct["skus"][number];
type LiveEstimateBreakdown = ReturnType<typeof calculateLogisticsEstimate>;
type ConfirmedOrder = {
  orderItemId?: string;
  skuId?: string;
  groupId?: string | null;
  groupCode?: string | null;
  status?: string;
  skuLabel: string;
  productCostCny?: number;
  estimatedTotalBdt?: number;
  pendingPayment?: boolean;
  requiredAmountCny?: number;
  reservedAmountCny?: number;
  uncoveredAmountCny?: number;
  appliedRate?: number | null;
};
export type ConfirmOrderResponse = {
  productOrderId?: string;
  orderNumber?: string;
  submittedAt?: string;
  groupId?: string | null;
  groupCode?: string | null;
  status?: string;
  pendingPayment?: boolean;
  walletBalanceCny?: number;
  requiredAmountCny?: number;
  reservedAmountCny?: number;
  uncoveredAmountCny?: number;
  appliedRate?: number | null;
  orderItems?: Array<Omit<ConfirmedOrder, "skuLabel">>;
};
type ApiErrorPayload = {
  error?: {
    message?: string;
    details?: unknown;
  };
};

type OrderReviewContext = {
  clientId: string;
  totals: { availableBalanceCny: number };
  exchangeRate: { cnyToBdt: number; effectiveOn: string };
};

export function ProductDetailBuyingInterface({
  product,
  clientId,
  onStartAgain,
  onConfirmed,
}: {
  product: ResolvedProduct;
  clientId: string;
  onStartAgain: () => void;
  onConfirmed?: (result: ConfirmOrderResponse) => void;
}) {
  const [selection, setSelection] = useState<ProductSkuSelectionState>(
    () => createInitialVariantSelection(product.skus),
  );
  const [weightInput, setWeightInput] = useState("");
  const [selectedTariff, setSelectedTariff] = useState<
    ShippingTariffItem | undefined
  >();
  const [tariffQuery, setTariffQuery] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmWarning, setConfirmWarning] = useState<string | null>(null);
  const [confirmedOrders, setConfirmedOrders] = useState<ConfirmedOrder[]>([]);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewContext, setReviewContext] = useState<OrderReviewContext | null>(null);
  const [reviewContextLoading, setReviewContextLoading] = useState(true);
  const [reviewContextError, setReviewContextError] = useState<string | null>(null);
  const confirmInFlight = useRef(false);
  const confirmIdempotencyKey = useRef(createIdempotencyKey());
  const attributeGroups = useMemo(
    () => getVariantAttributeGroups(product.skus),
    [product.skus],
  );
  const attributeNames = useMemo(
    () => Object.keys(attributeGroups),
    [attributeGroups],
  );
  const primaryAttributeName = useMemo(
    () => getPrimaryVariantAttributeName(attributeGroups),
    [attributeGroups],
  );
  const matchingSkus = useMemo(
    () => getMatchingVariantSkus(product.skus, selection.filters),
    [product.skus, selection.filters],
  );
  const activeSku = useMemo(
    () =>
      getResolvedVariantSku(product.skus, selection.filters, attributeNames),
    [attributeNames, product.skus, selection.filters],
  );
  const selectedLines = useMemo(
    () => getSelectedSkuLines(product.skus, selection),
    [product.skus, selection],
  );
  const summary = useMemo(
    () =>
      getSupplierSelectionSummary(
        product.skus,
        selection,
        product.domesticDeliveryCny,
      ),
    [product.domesticDeliveryCny, product.skus, selection],
  );
  const unitWeightKg = weightInput.trim() ? Number(weightInput) : undefined;
  const weightReady =
    unitWeightKg !== undefined &&
    Number.isFinite(unitWeightKg) &&
    unitWeightKg > 0;
  const liveEstimate = useMemo(() => {
    if (!selectedLines.length || !selectedTariff || !weightReady || !reviewContext) return null;
    try {
      return calculateLogisticsEstimate({
        productId: product.productId,
        exchangeRate: reviewContext.exchangeRate.cnyToBdt,
        internationalShippingCategory: selectedTariff.item,
        internationalShippingRateBdtPerKg: selectedTariff.rateBdtPerKg,
        lines: selectedLines.map((line) => ({
          skuId: line.sku.skuId,
          unitPriceCny: line.sku.priceCny,
          quantity: line.quantity,
          unitWeightKg,
        })),
      });
    } catch {
      return null;
    }
  }, [
    product.productId,
    reviewContext,
    selectedLines,
    selectedTariff,
    unitWeightKg,
    weightReady,
  ]);

  useEffect(() => {
    const controller = new AbortController();
    setReviewContextLoading(true);
    setReviewContextError(null);
    fetch("/api/client/order-review-context", { signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as { data?: OrderReviewContext; error?: { message?: string } };
        if (!response.ok || !payload.data) throw new Error(payload.error?.message || "Current wallet and exchange-rate data are unavailable.");
        setReviewContext(payload.data);
      })
      .catch((error: unknown) => {
        if ((error as { name?: string }).name !== "AbortError") setReviewContextError(error instanceof Error ? error.message : "Current wallet and exchange-rate data are unavailable.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setReviewContextLoading(false);
      });
    return () => controller.abort();
  }, [product.productId]);

  const resetConfirmState = () => {
    setConfirmError(null);
    setConfirmWarning(null);
    setConfirmedOrders([]);
    confirmIdempotencyKey.current = createIdempotencyKey();
  };
  const updateQuantity = (skuId: string, quantity: number) => {
    resetConfirmState();
    setSelection(
      setSkuSelectionQuantity(product.skus, selection, skuId, quantity),
    );
  };
  const selectAttribute = (name: string, value: string) => {
    const next = name === primaryAttributeName
      ? { ...selection, filters: { [name]: value } }
      : setSelectionFilter(selection, name, value);
    resetConfirmState();
    setSelection(next);
  };
  const selectSku = (skuId: string) => updateQuantity(skuId, 1);
  const clearSelection = () => {
    resetConfirmState();
    setSelection(createInitialVariantSelection(product.skus));
  };

  async function confirmOrder() {
    if (confirmInFlight.current) return;
    const validation = confirmValidation({
      lines: selectedLines,
      selectedTariff,
      weightReady,
      liveEstimate,
    });
    if (validation) {
      setConfirmError(validation);
      return;
    }
    if (!unitWeightKg) return;

    confirmInFlight.current = true;
    setConfirming(true);
    setConfirmError(null);
    setConfirmWarning(null);
    setConfirmedOrders([]);
    try {
      const response = await fetch("/api/orders/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId,
          productId: product.productId,
          estimatedUnitWeightKg: unitWeightKg,
          internationalShippingCategory: selectedTariff?.item,
          idempotencyKey: confirmIdempotencyKey.current,
          lines: selectedLines.map((line) => ({
            skuId: line.sku.skuId,
            quantity: line.quantity,
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        data?: ConfirmOrderResponse;
        meta?: {
          warnings?: Array<{
            code?: string;
            message?: string;
            walletBalanceCny?: number;
          }>;
        };
      } & ApiErrorPayload;
      if (!response.ok || !payload.data?.orderItems?.length) {
        setConfirmError(
          getApiErrorMessage(
            payload,
            "We could not confirm this order. No financial action was retried automatically.",
          ),
        );
        return;
      }

      setConfirmedOrders(
        payload.data.orderItems.map((order, index) => {
          const line =
            selectedLines.find((item) => item.sku.skuId === order.skuId) ??
            selectedLines[index];
          return {
            ...order,
            skuLabel: line ? getDisplayVariantLabel(line.sku) : "Selected SKU",
          };
        }),
      );
      const warning = payload.meta?.warnings?.find(
        (item) => item.code === "INSUFFICIENT_WALLET_BALANCE",
      )?.message;
      if (warning || payload.data.pendingPayment) {
        setConfirmWarning(
          warning ??
            "Order confirmed with partial wallet coverage. The uncovered supplier cost remains payable.",
        );
      }
      setSelection(clearProductSkuSelection());
      setWeightInput("");
      setSelectedTariff(undefined);
      setTariffQuery("");
      confirmIdempotencyKey.current = createIdempotencyKey();
      onConfirmed?.(payload.data);
    } catch {
      setConfirmError(
        "Network connection failed. No financial action was retried automatically.",
      );
    } finally {
      confirmInFlight.current = false;
      setConfirming(false);
    }
  }

  if (reviewOpen) {
    return (
      <DirectOrderReview
        product={product}
        lines={selectedLines}
        summary={summary}
        selectedTariff={selectedTariff}
        weightReady={weightReady}
        unitWeightKg={unitWeightKg}
        liveEstimate={liveEstimate}
        context={reviewContext}
        contextLoading={reviewContextLoading}
        contextError={reviewContextError}
        confirming={confirming}
        confirmError={confirmError}
        onEdit={() => setReviewOpen(false)}
        onConfirm={() => void confirmOrder()}
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">
            Product details
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">
            Review product and variants
          </h1>
          <p className="mt-2 max-w-reading text-sm leading-6 text-muted">
            Supplier pricing is shown in CNY. The estimate updates locally as
            you adjust variants, quantities, weight, and shipping tariff.
          </p>
        </div>
        <Button variant="outline" onClick={onStartAgain}>
          <RotateCcw aria-hidden="true" className="h-4 w-4" />
          Find another product
        </Button>
      </header>
      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(22rem,1.2fr)_23rem] xl:items-start">
        <ProductGallery
          product={product}
          selectedSkuImage={
            activeSku?.imageUrl ?? matchingSkus.find((sku) => sku.imageUrl)?.imageUrl ?? selectedLines[0]?.sku.imageUrl
          }
          onImageSelect={(image) => {
            const sku = product.skus.find((item) => item.imageUrl === image);
            if (sku && available(sku) && primaryAttributeName && sku.attributes[primaryAttributeName]) {
              resetConfirmState();
              setSelection({ ...selection, filters: { [primaryAttributeName]: sku.attributes[primaryAttributeName] } });
            }
          }}
        />
        <section className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Badge variant="commerce">{providerLabel(product.provider)}</Badge>
            <Badge variant="neutral">
              {product.category || "Uncategorized"}
            </Badge>
          </div>
          <h2 className="mt-4 break-words text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]">
            {product.title}
          </h2>
          {product.titleCn && (
            <p lang="zh" className="mt-2 break-words text-base leading-7 text-muted [overflow-wrap:anywhere]">{product.titleCn}</p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-4 rounded-card border border-border bg-surface-muted p-4 sm:grid-cols-3">
            <div className="col-span-2 sm:col-span-1"><PriceContext product={product} lines={selectedLines} subtotal={summary.supplierSubtotalCny} /></div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Domestic delivery</p>
              <PriceDisplay value={product.domesticDeliveryCny} currency="CNY" showCode size="md" className="mt-2" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
                Selected pieces
              </p>
              <p className="mt-2 text-xl font-semibold">
                {summary.selectedPieces || "-"}
              </p>
            </div>
          </div>
          <SKUSelection
            product={product}
            groups={attributeGroups}
            selection={selection}
            matchingSkus={matchingSkus}
            selectedLines={selectedLines}
            onFilter={selectAttribute}
            onSelect={selectSku}
            onQuantity={updateQuantity}
            summary={summary}
            onReview={() => setReviewOpen(true)}
          />
        </section>
        <div id="order-estimate-summary" className="min-w-0 scroll-mt-24 xl:sticky xl:top-24">
          <EstimateSummaryPanel
            lines={selectedLines}
            summary={summary}
            selectedTariff={selectedTariff}
            tariffQuery={tariffQuery}
            onTariffQueryChange={setTariffQuery}
            onTariffSelect={(tariff) => {
              resetConfirmState();
              setSelectedTariff(tariff);
            }}
            weightInput={weightInput}
            onWeightChange={(value) => {
              resetConfirmState();
              setWeightInput(value);
            }}
            liveEstimate={liveEstimate}
            weightReady={weightReady}
            confirmError={confirmError}
            confirmWarning={confirmWarning}
            confirmedOrders={confirmedOrders}
            onClear={clearSelection}
            onReview={() => setReviewOpen(true)}
          />
        </div>
      </div>
    </div>
  );
}

function DirectOrderReview({
  product,
  lines,
  summary,
  selectedTariff,
  weightReady,
  unitWeightKg,
  liveEstimate,
  context,
  contextLoading,
  contextError,
  confirming,
  confirmError,
  onEdit,
  onConfirm,
}: {
  product: ResolvedProduct;
  lines: SelectedSkuLine<ProductSku>[];
  summary: SupplierSelectionSummary;
  selectedTariff?: ShippingTariffItem;
  weightReady: boolean;
  unitWeightKg?: number;
  liveEstimate: LiveEstimateBreakdown | null;
  context: OrderReviewContext | null;
  contextLoading: boolean;
  contextError: string | null;
  confirming: boolean;
  confirmError: string | null;
  onEdit: () => void;
  onConfirm: () => void;
}) {
  const requiredCny = liveEstimate ? Number(liveEstimate.totalCnyCost) : null;
  const availableCny = context?.totals.availableBalanceCny ?? null;
  const coveredCny = requiredCny === null || availableCny === null ? null : Math.min(requiredCny, availableCny);
  const uncoveredCny = requiredCny === null || availableCny === null ? null : Math.max(requiredCny - availableCny, 0);
  const reviewReady = Boolean(liveEstimate && context && !contextLoading && !contextError);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-24 lg:pb-0">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Estimate review</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Review your order estimate</h1>
          <p className="mt-2 max-w-reading text-sm leading-6 text-muted">This is a current planning estimate. It is not saved or held until you confirm the order.</p>
        </div>
        <Button variant="outline" onClick={onEdit}>Back to selection</Button>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <section className="space-y-5">
          <Card className="p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <ProductThumbnail src={product.images[0]} alt={product.title} size="lg" className="h-16 w-16 rounded-control" />
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Selected product</p>
                <h2 className="mt-1 break-words text-base font-semibold">{product.title}</h2>
                <p className="mt-1 text-sm text-muted">{lines.length} {lines.length === 1 ? "SKU" : "SKUs"} · {summary.selectedPieces} pieces</p>
              </div>
            </div>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Selected colors and sizes</p>
            <div className="mt-4"><SelectedLines lines={lines} /></div>
          </Card>

          <Card className="p-4 sm:p-5">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">Estimate breakdown</p>
            <dl className="mt-4 space-y-4 text-sm">
              <ReviewDetail label="Product subtotal" value={<PriceDisplay value={summary.supplierSubtotalCny} currency="CNY" showCode size="sm" />} />
              <ReviewDetail label="Supplier delivery" value={<PriceDisplay value={summary.domesticDeliveryCny} currency="CNY" showCode size="sm" />} />
              <ReviewDetail label="Estimated weight" value={weightReady && liveEstimate ? `${liveEstimate.totalProductWeightKg} kg` : "Unavailable"} detail={unitWeightKg ? `${unitWeightKg} kg per unit` : "Add estimated unit weight"} />
              <ReviewDetail label="Bangladesh shipping category" value={selectedTariff?.item ?? "Not selected"} detail={selectedTariff ? `Tk ${selectedTariff.rateBdtPerKg}/kg` : undefined} />
              <ReviewDetail label="China warehouse processing" value={liveEstimate ? <PriceDisplay value={liveEstimate.chinaDomesticShippingCny} currency="CNY" showCode size="sm" /> : "Unavailable"} />
              <ReviewDetail label="China to Guangzhou" value={liveEstimate ? <PriceDisplay value={liveEstimate.chinaToGuangzhouCostCny} currency="CNY" showCode size="sm" /> : "Unavailable"} />
              <ReviewDetail label="Service charge" value={liveEstimate ? <PriceDisplay value={liveEstimate.serviceChargeCny} currency="CNY" showCode size="sm" /> : "Unavailable"} />
              <ReviewDetail label="Bangladesh shipping" value={liveEstimate ? <PriceDisplay value={liveEstimate.internationalShippingBdt} currency="BDT" showCode size="sm" /> : "Unavailable"} />
              <ReviewDetail label="Current exchange rate" value={context ? `1 CNY = ${context.exchangeRate.cnyToBdt.toFixed(4)} BDT` : "Loading"} detail={context ? `Effective ${context.exchangeRate.effectiveOn}` : undefined} />
            </dl>
          </Card>
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="overflow-hidden border-action-primary/20 shadow-panel">
            <div className="bg-action-primary p-5 text-on-action">
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-mint">Estimated final total</p>
              {liveEstimate ? <PriceDisplay value={liveEstimate.grandEstimatedTotalBdt} currency="BDT" showCode size="xl" className="mt-2 text-white [&_span]:text-white/70" /> : <p className="mt-2 text-2xl font-semibold">Not ready</p>}
            </div>
            <div className="space-y-4 p-5">
              {contextLoading && <Alert variant="warning" title="Loading current rate and wallet">Your estimate will update when the latest financial context is available.</Alert>}
              {contextError && <Alert variant="danger" title="Current financial context unavailable">{contextError}</Alert>}
              {!weightReady && <Alert variant="warning" title="Estimated weight required">Add an estimated unit weight to calculate shipping.</Alert>}
              {!selectedTariff && <Alert variant="warning" title="Shipping category required">Choose a Bangladesh shipping category before confirming.</Alert>}
              {requiredCny !== null && availableCny !== null && <div className="rounded-card bg-surface-muted p-4 text-sm"><p className="font-semibold text-foreground">Predicted wallet coverage</p><p className="mt-1 text-xs leading-5 text-muted">Pre-confirmation estimate using your current available wallet balance.</p><dl className="mt-3 space-y-2"><ReviewDetail label="Estimated CNY requirement" value={<PriceDisplay value={requiredCny} currency="CNY" showCode size="sm" />} /><ReviewDetail label="Available wallet balance" value={<PriceDisplay value={availableCny} currency="CNY" showCode size="sm" />} /><ReviewDetail label="Likely covered" value={<PriceDisplay value={coveredCny ?? 0} currency="CNY" showCode size="sm" />} /><ReviewDetail label="Likely uncovered" value={<PriceDisplay value={uncoveredCny ?? 0} currency="CNY" showCode size="sm" />} /></dl></div>}
              <Alert variant="warning" title="Estimate only">Actual supplier, weight, and logistics costs may differ. The server confirms the authoritative reservation and rate.</Alert>
              {confirmError && <Alert variant="danger" title="Order not confirmed">{confirmError}</Alert>}
              <Button size="lg" loading={confirming} disabled={!reviewReady || confirming} onClick={onConfirm} className="w-full"><Package aria-hidden="true" className="h-4 w-4" />Confirm order</Button>
              <Button variant="outline" onClick={onEdit} className="w-full">Edit selections</Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ReviewDetail({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return <div className="flex items-start justify-between gap-4"><div><dt className="text-muted">{label}</dt>{detail && <p className="mt-1 text-xs text-muted">{detail}</p>}</div><dd className="max-w-[55%] break-words text-right font-semibold text-foreground">{value}</dd></div>;
}

function ProductGallery({
  product,
  selectedSkuImage,
  onImageSelect,
}: {
  product: ResolvedProduct;
  selectedSkuImage?: string;
  onImageSelect: (image: string) => void;
}) {
  const images = useMemo(
    () =>
      Array.from(
        new Set(
          [selectedSkuImage, ...product.images].filter(
            (image): image is string => Boolean(image),
          ),
        ),
      ),
    [product.images, selectedSkuImage],
  );
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => {
    if (selectedSkuImage) setIndex(0);
  }, [selectedSkuImage]);
  const image = images[Math.min(index, Math.max(images.length - 1, 0))];
  return (
    <section aria-label="Product images" className="min-w-0">
      <div className="relative aspect-square overflow-hidden rounded-panel border border-border bg-surface-muted">
        {image && !failed.includes(image) ? (
          <img
            src={image}
            alt={`${product.title} product`}
            className="h-full w-full object-contain p-3"
            onError={() => setFailed((items) => [...items, image])}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-muted">
            <ImageOff aria-hidden="true" className="h-8 w-8" />
            <p className="mt-3 text-sm">Product image unavailable</p>
          </div>
        )}
      </div>
      {images.length > 1 && (
        <div className="mt-3 grid grid-cols-5 gap-2">
          {images.map((item, itemIndex) => (
            <button
              key={`${item}-${itemIndex}`}
              type="button"
              onClick={() => {
                setIndex(itemIndex);
                onImageSelect(item);
              }}
              className={cn(
                "focus-ring aspect-square overflow-hidden rounded-control border",
                index === itemIndex ? "border-action-primary" : "border-border",
              )}
            >
              <img
                src={item}
                alt=""
                className="h-full w-full object-contain p-1"
              />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
function PriceContext({
  product,
  lines,
  subtotal,
}: {
  product: ResolvedProduct;
  lines: SelectedSkuLine<ProductSku>[];
  subtotal: number;
}) {
  const min = product.priceMinCny ?? product.skus[0]?.priceCny;
  const max = product.priceMaxCny;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">
        {lines.length ? "Total Product Cost" : "Supplier price"}
      </p>
      {lines.length ? (
        <PriceDisplay
          value={subtotal}
          currency="CNY"
          showCode
          size="lg"
          className="mt-2"
        />
      ) : min === undefined ? (
        <span className="text-sm text-muted">Not returned</span>
      ) : (
        <div className="mt-2 flex items-center gap-1">
          <PriceDisplay value={min} currency="CNY" showCode size="lg" />
          {max !== undefined && max !== min && (
            <>
              <span>to</span>
              <PriceDisplay value={max} currency="CNY" showCode size="lg" />
            </>
          )}
        </div>
      )}
    </div>
  );
}
function SKUSelection({
  product,
  groups,
  selection,
  matchingSkus,
  selectedLines,
  onFilter,
  onSelect,
  onQuantity,
  summary,
  onReview,
}: {
  product: ResolvedProduct;
  groups: Record<string, string[]>;
  selection: ProductSkuSelectionState;
  matchingSkus: ProductSku[];
  selectedLines: SelectedSkuLine<ProductSku>[];
  onFilter: (name: string, value: string) => void;
  onSelect: (skuId: string) => void;
  onQuantity: (skuId: string, quantity: number) => void;
  summary: SupplierSelectionSummary;
  onReview: () => void;
}) {
  const hasVariantAttributes = Object.keys(groups).length > 0;
  const controls = (
    <VariantControls
      product={product}
      groups={groups}
      selection={selection}
      matchingSkus={matchingSkus}
      onFilter={onFilter}
      onSelect={onSelect}
      onQuantity={onQuantity}
    />
  );
  return (
    <section className="mt-8">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent-coral">
        Variants and quantities
      </p>
      <h3 className="mt-1 text-xl font-semibold">{hasVariantAttributes ? "Choose color, size, and quantity." : "Set product quantity."}</h3>
      <p className="mt-2 text-sm leading-6 text-muted">
        Select one or more available supplier combinations.
      </p>
      <div className="mt-5">{controls}</div>
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 -mx-2 mt-5 rounded-card border border-border bg-surface/95 p-3 shadow-overlay backdrop-blur md:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {summary.selectedPieces ? `${summary.selectedPieces} pieces across ${summary.selectedSkuCount} ${summary.selectedSkuCount === 1 ? "size" : "sizes"}` : "Choose sizes and quantities"}
            </p>
            <PriceDisplay value={summary.supplierSubtotalCny} currency="CNY" showCode size="sm" className="mt-0.5" />
          </div>
          <Button type="button" disabled={!selectedLines.length} onClick={onReview}>
            Review estimate
          </Button>
        </div>
      </div>
    </section>
  );
}
function VariantControls({
  product,
  groups,
  selection,
  matchingSkus,
  onFilter,
  onSelect,
  onQuantity,
}: {
  product: ResolvedProduct;
  groups: Record<string, string[]>;
  selection: ProductSkuSelectionState;
  matchingSkus: ProductSku[];
  onFilter: (name: string, value: string) => void;
  onSelect: (skuId: string) => void;
  onQuantity: (skuId: string, quantity: number) => void;
}) {
  const [visibleCount, setVisibleCount] = useState(50);
  const entries = Object.entries(groups);
  const primaryAttributeName = getPrimaryVariantAttributeName(groups);
  const primaryEntry = entries.find(([name]) => name === primaryAttributeName);
  const detailEntries = entries.filter(([name]) => name !== primaryAttributeName);
  const displaySkus = matchingSkus;
  const visible = displaySkus.slice(0, visibleCount);
  const selectedPrimaryValue = selection.filters[primaryAttributeName ?? ""];
  useEffect(() => setVisibleCount(50), [primaryAttributeName, selectedPrimaryValue]);
  if (!entries.length) return <UnattributedSkuControls skus={visible} fallbackImage={product.images[0]} selection={selection} onSelect={onSelect} onQuantity={onQuantity} />;
  return (
    <>
      <div className="space-y-5">
        {primaryEntry && [primaryEntry].map(([name, values]) => (
          <fieldset key={name}>
            <legend className="text-sm font-semibold">
              {translateVariantAttributeName(name)}
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {values.map((value) => {
                const state = getVariantOptionState(
                  product.skus,
                  selection.filters,
                  name,
                  value,
                );
                const selected = selection.filters[name] === value;
                const imageUrl = translateVariantAttributeName(name).toLowerCase().includes("color") ? variantImageForValue(product.skus, name, value) : undefined;
                const selectedPieces = selectedPiecesForOption(product.skus, selection, name, value);
                return (
                  <button
                    key={value}
                    type="button"
                    aria-label={`${translateVariantValue(value)}${state === "available" ? "" : " — unavailable"}`}
                    aria-pressed={selected}
                    disabled={state !== "available" && !selected}
                    onClick={() => onFilter(name, value)}
                    className={cn(
                      "focus-ring relative min-h-touch rounded-control border text-sm font-semibold transition-colors",
                      imageUrl ? "w-[5.5rem] overflow-hidden p-1.5 text-left" : "px-3 py-2",
                      selected
                        ? "border-action-primary bg-action-soft"
                        : state === "available"
                          ? "border-border"
                          : "cursor-not-allowed border-border bg-surface-muted text-muted line-through",
                    )}
                  >
                    {selectedPieces > 0 && <span aria-hidden="true" className="absolute left-1 top-1 z-10 min-w-6 rounded-full bg-action-primary px-1.5 py-0.5 text-center text-[0.6875rem] font-bold leading-4 text-on-action shadow-sm">{selectedPieces}</span>}
                    {imageUrl && <ProductThumbnail src={imageUrl} alt={translateVariantValue(value)} size="md" className="mb-1.5 h-14 w-full rounded-control border-0" imageClassName="p-0" />}
                    <span className={cn("block", imageUrl && "truncate px-1 pb-0.5 text-xs")}>{translateVariantValue(value)}</span>
                    {state !== "available" && <span className="sr-only">Unavailable</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>
      <div className="mt-6 flex items-end justify-between gap-3 border-b border-border pb-2">
        <div>
          <p className="text-sm font-semibold text-foreground">{detailEntries.length ? detailEntries.map(([name]) => translateVariantAttributeName(name)).join(" / ") : "Available options"}</p>
          <p className="mt-0.5 text-xs text-muted">{selection.filters[primaryAttributeName ?? ""] ? `${translateVariantValue(selection.filters[primaryAttributeName ?? ""])} options` : "Select an option above"}</p>
        </div>
        <span className="text-xs font-semibold text-muted">{displaySkus.length} returned</span>
      </div>
      <div className="mt-6 space-y-3 md:hidden">
        {visible.map((sku) => (
          <MobileVariantRow
            key={sku.skuId}
            sku={sku}
            names={detailEntries.map(([name]) => name)}
            quantity={selection.quantitiesBySkuId[sku.skuId] ?? 0}
            fallbackImage={product.images[0]}
            compact
            onSelect={() => onSelect(sku.skuId)}
            onQuantity={(quantity) => onQuantity(sku.skuId, quantity)}
          />
        ))}
        {!visible.length && <p className="rounded-card border border-border p-5 text-center text-sm text-muted">No returned variants match these choices.</p>}
      </div>
      <div className="mt-6 hidden overflow-x-auto rounded-card border border-border md:block">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="bg-surface-muted text-xs font-bold uppercase tracking-[0.1em] text-muted">
            <tr>
              {detailEntries.map(([name]) => (
                <th key={name} className="px-4 py-3">
                  {translateVariantAttributeName(name)}
                </th>
              ))}
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3">Quantity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.map((sku) => (
              <VariantRow
                key={sku.skuId}
                sku={sku}
                names={detailEntries.map(([name]) => name)}
                quantity={selection.quantitiesBySkuId[sku.skuId] ?? 0}
                onSelect={() => onSelect(sku.skuId)}
                onQuantity={(quantity) => onQuantity(sku.skuId, quantity)}
              />
            ))}
          </tbody>
        </table>
        {!visible.length && (
          <p className="p-6 text-center text-sm text-muted">
            No returned variants match these choices.
          </p>
        )}
      </div>
      {displaySkus.length > visible.length && (
        <Button
          variant="ghost"
          size="sm"
          className="mx-auto mt-2 flex"
          onClick={() => setVisibleCount((count) => count + 50)}
        >
          Show 50 more ({displaySkus.length - visible.length} remaining)
        </Button>
      )}
    </>
  );
}
function MobileVariantRow({
  sku,
  names,
  quantity,
  fallbackImage,
  compact = false,
  onSelect,
  onQuantity,
}: {
  sku: ProductSku;
  names: string[];
  quantity: number;
  fallbackImage?: string;
  compact?: boolean;
  onSelect: () => void;
  onQuantity: (quantity: number) => void;
}) {
  const unavailable = !available(sku);
  const label = displayVariantValues(sku, names);
  return (
    <article data-unavailable={unavailable || undefined} className={cn("rounded-card border border-border bg-surface p-3.5", quantity > 0 && "border-action-primary/50 bg-action-soft/35", unavailable && "bg-surface-muted/70")}>
      <div className="flex items-start gap-3">
        {!compact && <ProductThumbnail src={sku.imageUrl ?? fallbackImage} alt={getDisplayVariantLabel(sku)} size="md" className="h-14 w-14 rounded-control" />}
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{label}</p>
          {names.length > 0 && <p className="mt-1 text-xs leading-5 text-muted">{names.map((name) => `${translateVariantAttributeName(name)}: ${translateVariantValue(sku.attributes[name] ?? "-")}`).join(" · ")}</p>}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <div><PriceDisplay value={sku.priceCny} currency="CNY" showCode size="sm" /><p className={cn("mt-1 text-xs font-medium", unavailable ? "text-danger" : "text-muted")}>{unavailable ? "Out of stock" : `Stock: ${sku.availableQuantity ?? "Not returned"}`}</p></div>
        {compact ? <QuantityStepper className="[&>label]:sr-only" label={`${label} quantity`} value={quantity} min={0} max={sku.availableQuantity} disabled={unavailable} onChange={onQuantity} /> : quantity ? <QuantityStepper className="[&>label]:sr-only" label={`${label} quantity`} value={quantity} min={0} max={sku.availableQuantity} onChange={onQuantity} /> : <Button variant="outline" size="sm" disabled={unavailable} onClick={onSelect}>{unavailable ? "Unavailable" : "Select"}</Button>}
      </div>
    </article>
  );
}
function VariantRow({
  sku,
  names,
  quantity,
  onSelect,
  onQuantity,
}: {
  sku: ProductSku;
  names: string[];
  quantity: number;
  onSelect: () => void;
  onQuantity: (quantity: number) => void;
}) {
  const unavailable = !available(sku);
  return (
    <tr className={cn(quantity > 0 && "bg-action-soft/60")}>
      {names.map((name) => (
        <td key={name} className="px-4 py-3 font-medium">
          {translateVariantValue(sku.attributes[name] ?? "-")}
        </td>
      ))}
      <td className="px-4 py-3">
        <PriceDisplay value={sku.priceCny} currency="CNY" showCode size="sm" />
      </td>
      <td className={cn("px-4 py-3", unavailable && "text-danger")}>
        {sku.availableQuantity ?? "Not returned"}
      </td>
      <td className="px-4 py-3">
        {quantity ? (
          <QuantityStepper
            className="[&>label]:sr-only"
            label={`${getDisplayVariantLabel(sku)} quantity`}
            value={quantity}
            min={0}
            max={sku.availableQuantity}
            onChange={onQuantity}
          />
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={unavailable}
            onClick={onSelect}
          >
            Select
          </Button>
        )}
      </td>
    </tr>
  );
}

function UnattributedSkuControls({ skus, fallbackImage, selection, onSelect, onQuantity }: { skus: ProductSku[]; fallbackImage?: string; selection: ProductSkuSelectionState; onSelect: (skuId: string) => void; onQuantity: (skuId: string, quantity: number) => void }) {
  if (!skus.length) return <p className="rounded-card border border-border bg-surface-muted p-4 text-sm text-muted">The supplier did not return a selectable SKU.</p>;
  return <div className="space-y-3"><p className="text-sm leading-6 text-muted">This product has no color or size choices. Set the quantity for the available supplier item.</p>{skus.map((sku) => <MobileVariantRow key={sku.skuId} sku={sku} names={[]} fallbackImage={fallbackImage} quantity={selection.quantitiesBySkuId[sku.skuId] ?? 0} onSelect={() => onSelect(sku.skuId)} onQuantity={(quantity) => onQuantity(sku.skuId, quantity)} />)}</div>;
}

function variantImageForValue(skus: ProductSku[], name: string, value: string) {
  return skus.find((sku) => sku.attributes[name] === value && sku.imageUrl)?.imageUrl;
}

function getPrimaryVariantAttributeName(groups: Record<string, string[]>) {
  const names = Object.keys(groups);
  return names.find((name) => translateVariantAttributeName(name).toLowerCase().includes("color")) ?? names[0];
}

function createInitialVariantSelection(skus: ProductSku[]): ProductSkuSelectionState {
  const groups = getVariantAttributeGroups(skus);
  const primaryName = getPrimaryVariantAttributeName(groups);
  const firstValue = primaryName ? groups[primaryName]?.[0] : undefined;
  return { filters: primaryName && firstValue ? { [primaryName]: firstValue } : {}, quantitiesBySkuId: {} };
}

function selectedPiecesForOption(skus: ProductSku[], selection: ProductSkuSelectionState, name: string, value: string) {
  return skus.reduce((total, sku) => sku.attributes[name] === value ? total + (selection.quantitiesBySkuId[sku.skuId] ?? 0) : total, 0);
}

function displayVariantValues(sku: ProductSku, names: string[]) {
  if (!names.length) return getDisplayVariantLabel(sku);
  return names.map((name) => translateVariantValue(sku.attributes[name] ?? "-")).join(" / ");
}

function EstimateSummaryPanel({
  lines,
  summary,
  selectedTariff,
  tariffQuery,
  onTariffQueryChange,
  onTariffSelect,
  weightInput,
  onWeightChange,
  liveEstimate,
  weightReady,
  confirmError,
  confirmWarning,
  confirmedOrders,
  onClear,
  onReview,
}: {
  lines: SelectedSkuLine<ProductSku>[];
  summary: SupplierSelectionSummary;
  selectedTariff?: ShippingTariffItem;
  tariffQuery: string;
  onTariffQueryChange: (value: string) => void;
  onTariffSelect: (value: ShippingTariffItem) => void;
  weightInput: string;
  onWeightChange: (value: string) => void;
  liveEstimate: LiveEstimateBreakdown | null;
  weightReady: boolean;
  confirmError: string | null;
  confirmWarning: string | null;
  confirmedOrders: ConfirmedOrder[];
  onClear: () => void;
  onReview: () => void;
}) {
  return (
    <Card className="overflow-hidden border-action-primary/20 shadow-panel">
      <div className="border-b border-action-primary/10 bg-action-soft p-5">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-action-primary">
          Live estimate
        </p>
        <h2 className="mt-1 text-xl font-semibold">Confirm order</h2>
        <p className="mt-2 text-sm leading-6 text-muted">
          This estimate is temporary and updates before anything is saved.
        </p>
      </div>
      <div className="space-y-5 p-5">
        <SummaryRow
          label="Selected variations"
          value={summary.selectedSkuCount || "None"}
        />
        <SummaryRow
          label="Selected quantity"
          value={summary.selectedPieces || "-"}
        />
        {lines.length > 0 && <SelectedLines lines={lines} />}
        <Input
          id="estimated-unit-weight"
          label="Estimated unit weight (kg)"
          type="number"
          inputMode="decimal"
          min="0.001"
          step="0.001"
          value={weightInput}
          onChange={(event) => onWeightChange(event.target.value)}
          hint="Required for shipping estimate. Use actual product/SKU weight when available."
        />
        {!weightReady && (
          <Alert variant="warning" title="Product weight unavailable">
            International shipping estimate cannot be calculated yet.
          </Alert>
        )}
        <ShippingTariffSelector
          value={selectedTariff}
          query={tariffQuery}
          onQueryChange={onTariffQueryChange}
          onSelect={onTariffSelect}
        />
        {!selectedTariff && (
          <Alert variant="warning" title="Shipping tariff required">
            Select a tariff item before calculating the international shipping
            estimate.
          </Alert>
        )}
        <dl className="space-y-3 border-y border-border py-4 text-sm">
          <SummaryRow
            label="Product Base Cost"
            value={
              <PriceDisplay
                value={
                  liveEstimate?.productBaseCostCny ??
                  summary.supplierSubtotalCny
                }
                currency="CNY"
                showCode
                size="sm"
              />
            }
          />
          <SummaryRow
            label="Huai'an Warehouse"
            value={
              <CostValue
                estimate={liveEstimate}
                field="chinaDomesticShippingCny"
              />
            }
            detail="4 CNY/KG"
          />
          <SummaryRow
            label="China to Guangzhou"
            value={
              <CostValue
                estimate={liveEstimate}
                field="chinaToGuangzhouCostCny"
              />
            }
            detail="4 CNY/KG"
          />
          <SummaryRow
            label="Service Charge"
            value={
              <CostValue estimate={liveEstimate} field="serviceChargeCny" />
            }
            detail="6% of Product Base Cost"
          />
          <SummaryRow
            label="CNY to BDT exchange"
            value={liveEstimate ? `1 CNY = ${liveEstimate.exchangeRate} BDT` : "Loading current rate"}
          />
          <SummaryRow
            label="Estimated weight"
            value={
              liveEstimate ? `${liveEstimate.totalProductWeightKg} kg` : "-"
            }
          />
          <SummaryRow
            label="Bangladesh international shipping"
            value={
              liveEstimate ? (
                <PriceDisplay
                  value={liveEstimate.internationalShippingBdt}
                  currency="BDT"
                  showCode
                  size="sm"
                />
              ) : (
                "-"
              )
            }
            detail={
              selectedTariff
                ? `${selectedTariff.item} at Tk ${selectedTariff.rateBdtPerKg}/kg`
                : undefined
            }
          />
        </dl>
        <div className="grid gap-3 rounded-card bg-action-primary p-4 text-on-action">
          <TotalRow
            label="Total Product Cost"
            value={
              <PriceDisplay
                value={
                  liveEstimate?.productBaseCostCny ??
                  summary.supplierSubtotalCny
                }
                currency="CNY"
                showCode
                size="lg"
                className="text-white [&_span]:text-white/70"
              />
            }
          />
          <TotalRow
            label="Total Estimated Cost"
            value={
              liveEstimate ? (
                <PriceDisplay
                  value={liveEstimate.grandEstimatedTotalBdt}
                  currency="BDT"
                  showCode
                  size="xl"
                  className="text-white [&_span]:text-white/70"
                />
              ) : (
                "Not ready"
              )
            }
          />
        </div>
        {confirmedOrders.length > 0 && (
          <Alert variant="success" title="Order confirmed">
            {confirmedOrders.map((order) => (
              <span
                key={`${order.skuLabel}-${order.orderItemId ?? order.skuId}`}
                className="block"
              >
                {order.skuLabel}:{" "}
                {order.orderItemId ?? "order item not returned"} ·{" "}
                {humanizeStatus(order.status ?? "pending_admin_review")} ·
                reserved CNY {Number(order.reservedAmountCny ?? 0).toFixed(2)} ·
                uncovered CNY {Number(order.uncoveredAmountCny ?? 0).toFixed(2)}
                {order.appliedRate
                  ? ` · rate ${Number(order.appliedRate).toFixed(4)} BDT/CNY`
                  : ""}
              </span>
            ))}
          </Alert>
        )}
        {confirmWarning && (
          <Alert variant="warning" title="Pending payment">
            {confirmWarning}
          </Alert>
        )}
        {confirmError && (
          <Alert variant="danger" title="Order not confirmed">
            {confirmError}
          </Alert>
        )}
        <Button size="lg" disabled={!lines.length} onClick={onReview} className="w-full">
          <Package aria-hidden="true" className="h-4 w-4" />
          Review estimate
        </Button>
        {lines.length > 0 && (
          <Button variant="ghost" onClick={onClear} className="w-full">
            Clear selection
          </Button>
        )}
      </div>
    </Card>
  );
}

function SelectedLines({ lines }: { lines: SelectedSkuLine<ProductSku>[] }) {
  return (
    <div className="rounded-control bg-surface-muted p-3">
      <p className="text-xs font-semibold text-muted">
        Selected supplier items
      </p>
      <div className="mt-2 space-y-2">
        {lines.map((line) => (
          <div key={line.sku.skuId} className="grid gap-1 text-sm">
            <p className="font-semibold">{getDisplayVariantLabel(line.sku)}</p>
            <div className="flex flex-wrap justify-between gap-2 text-muted">
              <span>
                {line.quantity} x{" "}
                <PriceDisplay
                  value={line.sku.priceCny}
                  currency="CNY"
                  showCode
                  size="sm"
                />
              </span>
              <PriceDisplay
                value={line.sku.priceCny * line.quantity}
                currency="CNY"
                showCode
                size="sm"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function CostValue({
  estimate,
  field,
}: {
  estimate: LiveEstimateBreakdown | null;
  field:
    "chinaDomesticShippingCny" | "chinaToGuangzhouCostCny" | "serviceChargeCny";
}) {
  return estimate ? (
    <PriceDisplay value={estimate[field]} currency="CNY" showCode size="sm" />
  ) : (
    "-"
  );
}
function SummaryRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted">
        {label}
        {detail && <span className="mt-1 block text-xs">{detail}</span>}
      </dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
function TotalRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
      <dt className="text-on-action/60">{label}</dt>
      <dd className="min-w-0 text-left font-semibold sm:text-right [&_[data-currency]]:inline-flex [&_[data-currency]]:flex-wrap [&_[data-currency]]:break-normal">
        {value}
      </dd>
    </div>
  );
}
function getApiErrorMessage(payload: ApiErrorPayload, fallback: string) {
  const details = payload.error?.details;
  if (details && typeof details === "object" && "message" in details) {
    const message = (details as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return payload.error?.message || fallback;
}
function confirmValidation({
  lines,
  selectedTariff,
  weightReady,
  liveEstimate,
}: {
  lines: SelectedSkuLine<ProductSku>[];
  selectedTariff?: ShippingTariffItem;
  weightReady: boolean;
  liveEstimate: LiveEstimateBreakdown | null;
}) {
  if (!lines.length)
    return "Select at least one available product combination and quantity before confirming.";
  if (lines.some((line) => !available(line.sku)))
    return "One selected SKU is out of stock. Update the selection before confirming.";
  if (
    lines.some(
      (line) => !Number.isFinite(line.sku.priceCny) || line.sku.priceCny < 0,
    )
  )
    return "A selected SKU has an invalid supplier price.";
  if (!selectedTariff)
    return "Select a valid shipping tariff item before confirming.";
  if (!weightReady)
    return "Product weight unavailable - international shipping estimate cannot be calculated yet.";
  if (!liveEstimate) return "The estimate is not ready yet.";
  return null;
}
function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
function available(sku: ProductSku) {
  return sku.availableQuantity === undefined || sku.availableQuantity > 0;
}
function providerLabel(provider: string) {
  return provider === "alibaba1688"
    ? "1688"
    : provider === "taobao"
      ? "Taobao / Tmall"
      : provider;
}
function humanizeStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
