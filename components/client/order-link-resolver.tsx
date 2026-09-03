"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card, PageHeader } from "@/components/ui";
import { ProductLinkEntry, type ResolvedProduct } from "@/components/client/product-link-entry";
import { OrderConfirmationResult } from "@/components/client/order-confirmation-result";
import { ProductDetailBuyingInterface, type ConfirmOrderResponse } from "@/components/client/product-detail-buying-interface";

export function OrderLinkResolver({ initialUrl, clientId, initialProduct }: { initialUrl: string; clientId: string; initialProduct?: ResolvedProduct }) {
  const [product, setProduct] = useState<ResolvedProduct | null>(initialProduct ?? null);
  const [entryKey, setEntryKey] = useState(0);
  const [entryInitialUrl, setEntryInitialUrl] = useState(initialUrl);
  const [confirmation, setConfirmation] = useState<ConfirmOrderResponse | null>(null);

  function startFresh() {
    setProduct(null);
    setEntryInitialUrl("");
    setConfirmation(null);
    setEntryKey((current) => current + 1);
  }

  return (
    <>
      <PageHeader
        eyebrow="New order"
        title="New order"
        description="Find and add products from supported China marketplaces through your authenticated client session."
        actions={<Link href="/client" className="focus-ring inline-flex min-h-touch items-center gap-2 rounded-control px-3 py-2 text-sm font-semibold text-action-primary hover:bg-action-soft"><ArrowLeft aria-hidden="true" className="h-4 w-4" />Dashboard</Link>}
      />

      <Card data-page-section="new-order" className="mt-7 p-5 shadow-panel sm:p-6">
        {confirmation && product ? (
          <OrderConfirmationResult result={confirmation} product={product} onStartAnother={startFresh} />
        ) : !product ? (
          <ProductLinkEntry key={entryKey} initialUrl={entryInitialUrl} onResolved={(resolvedProduct) => { setConfirmation(null); setProduct(resolvedProduct); }} />
        ) : (
          <ProductDetailBuyingInterface
            product={product}
            clientId={clientId}
            onStartAgain={startFresh}
            onConfirmed={setConfirmation}
          />
        )}
      </Card>
    </>
  );
}
