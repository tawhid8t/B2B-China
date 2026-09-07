"use client";

import { CheckCircle2, ClipboardPaste, Link2, LoaderCircle, RefreshCw, ShieldCheck, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Badge, Button, Input } from "@/components/ui";
import { cn } from "@/lib/ui/cn";

export type ResolvedProduct = {
  productId: string;
  provider: string;
  providerItemId: string;
  originalUrl: string;
  title: string;
  titleCn?: string;
  images: string[];
  category: string;
  domesticDeliveryCny: number;
  priceMinCny?: number;
  priceMaxCny?: number;
  skus: Array<{
    skuId: string;
    providerSkuId?: string;
    label: string;
    attributes: Record<string, string>;
    priceCny: number;
    availableQuantity?: number;
    imageUrl?: string;
  }>;
};

type ResolutionFailure = {
  kind: "provider" | "manual" | "connection" | "cancelled";
  title: string;
  message: string;
};

type ProductLinkEntryProps = {
  initialUrl?: string;
  onResolved: (product: ResolvedProduct) => void;
  className?: string;
};

export function ProductLinkEntry({ initialUrl = "", onResolved, className }: ProductLinkEntryProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState(initialUrl.trim());
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [failure, setFailure] = useState<ResolutionFailure | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const resolvingRef = useRef(false);
  const activeRequestRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);
  const automaticallyResolvedUrl = useRef<string | null>(null);
  const marketplace = useMemo(() => detectMarketplace(url), [url]);

  function updateUrl(value: string) {
    setUrl(value);
    if (fieldError) setFieldError(undefined);
    if (failure) setFailure(null);
  }

  function trimUrl() {
    const trimmed = url.trim();
    if (trimmed !== url) setUrl(trimmed);
  }

  async function pasteFromClipboard() {
    try {
      const pasted = await navigator.clipboard.readText();
      if (pasted) updateUrl(pasted.trim());
      inputRef.current?.focus();
    } catch {
      inputRef.current?.focus();
    }
  }

  async function resolveProduct(requestedUrl?: string) {
    if (resolvingRef.current) return;
    const value = (requestedUrl ?? url).trim();
    setUrl(value);
    if (!value) {
      setFieldError("Paste a supplier product link to continue.");
      return;
    }

    if (!detectMarketplace(value)) {
      setFieldError("Use a public product link from 1688, Taobao, or Tmall.");
      return;
    }

    setFieldError(undefined);
    setFailure(null);
    resolvingRef.current = true;
    setLoading(true);
    setLoadingStage(0);
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    try {
      const response = await fetch("/api/products/resolve-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
        signal: abortController.signal
      });
      const payload = await response.json().catch(() => ({})) as { data?: ResolvedProduct; error?: { code?: string; message?: string; details?: { retryAfterSeconds?: number } } };
      if (activeRequestRef.current !== requestId) return;
      if (!response.ok || !payload.data) {
        const code = payload.error?.code;
        const message = payload.error?.message || "The product could not be resolved. Your supplier link is still available to retry.";
        if (code === "VALIDATION_ERROR") {
          setFieldError(message);
        } else if (code === "MANUAL_REVIEW_REQUIRED") {
          setFailure({ kind: "manual", title: "This product needs manual review", message });
        } else {
          setFailure({ kind: "provider", title: "We could not resolve this product", message });
        }
        return;
      }
      onResolved(payload.data);
    } catch {
      if (abortController.signal.aborted || activeRequestRef.current !== requestId) return;
      setFailure({ kind: "connection", title: "Connection problem", message: "We could not reach the product service. Your supplier link is still here; check your connection and try again." });
    } finally {
      if (activeRequestRef.current === requestId) {
        resolvingRef.current = false;
        abortControllerRef.current = null;
        setLoading(false);
      }
    }
  }

  function cancelResolution() {
    if (!resolvingRef.current) return;
    activeRequestRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    resolvingRef.current = false;
    setLoading(false);
    setFailure({ kind: "cancelled", title: "Product lookup cancelled", message: "Your supplier link is still here. You can retry whenever you are ready." });
  }

  useEffect(() => {
    if (!loading) return;
    const detailTimer = window.setTimeout(() => setLoadingStage(1), 1_200);
    const variantTimer = window.setTimeout(() => setLoadingStage(2), 4_000);
    return () => {
      window.clearTimeout(detailTimer);
      window.clearTimeout(variantTimer);
    };
  }, [loading]);

  useEffect(() => () => abortControllerRef.current?.abort(), []);

  useEffect(() => {
    const value = initialUrl.trim();
    if (!value || automaticallyResolvedUrl.current === value) return;
    automaticallyResolvedUrl.current = value;
    setUrl(value);
    void resolveProduct(value);
  // A dashboard-provided URL should continue directly into the real resolver once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialUrl]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!loading) void resolveProduct();
  }

  if (loading) {
    return <ProductResolutionLoading url={url} marketplace={marketplace?.label} stage={loadingStage} onCancel={cancelResolution} className={className} />;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Add a supplier product</h2>
        <p className="mt-1 text-sm leading-6 text-muted">Paste a public 1688, Taobao, or Tmall product link. 1688 mobile share messages are supported too.</p>
      </div>
      <form onSubmit={submit} noValidate className="space-y-3">
        <div className="relative">
          <Input
            ref={inputRef}
            id="supplier-product-link"
            label="Product link"
            type="text"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={url}
            onBlur={trimUrl}
            onChange={(event) => updateUrl(event.target.value)}
            placeholder="Paste product link here"
            hint={marketplace ? undefined : "Supported sources: 1688, Taobao, and Tmall."}
            error={fieldError}
            className="pr-24"
          />
          {url && <button type="button" onClick={() => updateUrl("")} aria-label="Clear product link" className="focus-ring absolute right-2 top-8 grid h-10 w-10 place-items-center rounded-control text-muted hover:bg-surface-muted hover:text-foreground"><X aria-hidden="true" className="h-4 w-4" /></button>}
          {!url && <button type="button" onClick={() => void pasteFromClipboard()} className="focus-ring absolute right-2 top-8 inline-flex h-10 items-center gap-1.5 rounded-control px-2 text-xs font-semibold text-action-primary hover:bg-action-soft"><ClipboardPaste aria-hidden="true" className="h-4 w-4" />Paste</button>}
        </div>
        <div className="rounded-card border border-action-primary/20 bg-action-soft/55 p-4" aria-label="Supported product links">
          <div className="flex items-start gap-3">
            <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-action-primary" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Supported public links</p>
              <p className="mt-1 text-sm leading-5 text-muted">We read product titles, prices, variants, and availability. Sign-in-only supplier pages cannot be resolved.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-6" aria-live="polite">{marketplace && <Badge variant={marketplace.variant}>{marketplace.label} detected</Badge>}</div>
          <Button type="submit" size="lg" className="w-full sm:w-auto"><Link2 aria-hidden="true" className="h-4 w-4" />Resolve product</Button>
        </div>
      </form>
      {failure && <ResolutionFailureState failure={failure} onRetry={() => void resolveProduct()} />}
    </div>
  );
}

function ProductResolutionLoading({ url, marketplace, stage, onCancel, className }: { url: string; marketplace?: string; stage: number; onCancel: () => void; className?: string }) {
  const stages = [
    { title: "Contacting the product provider", detail: `Opening the public ${marketplace ?? "supplier"} product link securely.` },
    { title: "Checking product details", detail: "Reading the supplier title, images, price, and delivery information." },
    { title: "Reading variants and availability", detail: "Checking colors, sizes, SKU prices, and current supplier stock." }
  ];
  const current = stages[Math.min(stage, stages.length - 1)];
  return <div className={cn("space-y-3 sm:space-y-4", className)}>
    <div><h2 className="text-xl font-semibold tracking-tight text-foreground">Checking product details</h2><p className="mt-1 text-sm leading-6 text-muted">This can take a few moments while the supplier prepares the product.</p></div>
    <div><label htmlFor="resolving-product-link" className="mb-1.5 block text-sm font-semibold text-foreground">Product link</label><input id="resolving-product-link" readOnly value={url} className="min-h-touch-lg w-full truncate rounded-control border border-border bg-surface-muted px-3.5 py-2.5 text-sm text-foreground shadow-sm" /></div>
    <div data-ui="product-loading" role="status" aria-live="polite" aria-atomic="true" className="relative overflow-hidden rounded-card border border-border bg-surface p-4 shadow-soft sm:p-5">
      <div className="product-loading-scan" aria-hidden="true" />
      <div className="relative grid grid-cols-[6.5rem_1fr] gap-3 sm:grid-cols-[8rem_1fr]">
        <div className="min-h-32 animate-pulse rounded-control bg-surface-muted motion-reduce:animate-none" aria-hidden="true" />
        <div className="space-y-3 pt-1" aria-hidden="true"><div className="h-3 w-full animate-pulse rounded-full bg-border motion-reduce:animate-none" /><div className="h-3 w-4/5 animate-pulse rounded-full bg-border motion-reduce:animate-none" /><div className="h-3 w-3/5 animate-pulse rounded-full bg-border motion-reduce:animate-none" /><div className="grid grid-cols-3 gap-2 pt-3"><span className="h-11 animate-pulse rounded-control bg-surface-muted motion-reduce:animate-none" /><span className="h-11 animate-pulse rounded-control bg-surface-muted motion-reduce:animate-none" /><span className="h-11 animate-pulse rounded-control bg-surface-muted motion-reduce:animate-none" /></div></div>
      </div>
      <div className="relative mt-5 flex items-start gap-3 border-t border-border pt-4"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-action-soft text-action-primary"><LoaderCircle aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" /></span><div><p className="text-sm font-semibold text-foreground">{current.title}</p><p className="mt-0.5 text-sm leading-5 text-muted">{current.detail}</p></div></div>
      <div className="relative mt-4 flex items-center gap-2 text-xs font-semibold text-action-primary"><ShieldCheck aria-hidden="true" className="h-4 w-4 shrink-0" /><span>No price or stock information is guessed.</span></div>
    </div>
    <Button type="button" variant="outline" size="lg" onClick={onCancel} className="w-full">Cancel lookup</Button>
  </div>;
}

function ResolutionFailureState({ failure, onRetry }: { failure: ResolutionFailure; onRetry: () => void }) {
  if (failure.kind === "manual") {
    return <Alert variant="warning" title={failure.title}><p>{failure.message}</p><Link href="/contact" className="focus-ring mt-3 inline-flex min-h-touch items-center rounded-control px-2 py-2 text-sm font-semibold text-foreground underline decoration-warning/50 underline-offset-4 hover:decoration-warning">Review contact guidance</Link></Alert>;
  }

  if (failure.kind === "cancelled") {
    return <Alert variant="info" title={failure.title}><p>{failure.message}</p><Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-3"><RefreshCw aria-hidden="true" className="h-4 w-4" />Retry lookup</Button></Alert>;
  }

  return <Alert variant="danger" title={failure.title}><p>{failure.message}</p><Button type="button" variant="outline" size="sm" onClick={onRetry} className="mt-3 border-danger/30 bg-surface text-foreground hover:bg-danger/10"><RefreshCw aria-hidden="true" className="h-4 w-4" />Try again</Button></Alert>;
}

function detectMarketplace(value: string): { label: "1688" | "Taobao" | "Tmall"; variant: "commerce" | "vermilion" | "gold" } | null {
  try {
    const link = value.trim().match(/https?:\/\/[^\s\]\[<>"'，。、】【）)]+/iu)?.[0] ?? value.trim();
    const host = new URL(link).hostname.toLowerCase();
    if (host === "1688.com" || host.endsWith(".1688.com")) return { label: "1688", variant: "commerce" };
    if (host === "taobao.com" || host.endsWith(".taobao.com")) return { label: "Taobao", variant: "vermilion" };
    if (host === "tmall.com" || host.endsWith(".tmall.com")) return { label: "Tmall", variant: "gold" };
  } catch {
    return null;
  }
  return null;
}
