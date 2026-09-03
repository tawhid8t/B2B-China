import { PackagePlus } from "lucide-react";
import Link from "next/link";
import { ClientOrderCards } from "@/components/client/client-order-cards";
import { ClientShell } from "@/components/client/client-shell";
import { PageHeader } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";

const orders = [
  {
    orderId: "order-1", productId: "product-24081", displayOrderNumber: "BC-24081", orderedAt: "2026-08-29T10:30:00.000Z", status: "arrived_guangzhou",
    product: { imageUrl: null, productUrl: null, shortDescription: "Wireless accessories", storeName: "Guangzhou electronics store", storeAccount: null },
    skus: [
      { id: "sku-1", imageUrl: null, description: "USB-C cable · 1 metre", color: "White", size: null, unitPriceCny: 22, quantity: 120, subtotalCny: 2640, subtotalBdt: 43428, status: "arrived_guangzhou", note: null },
      { id: "sku-2", imageUrl: null, description: "Fast charging adapter", color: "Black", size: null, unitPriceCny: 38, quantity: 24, subtotalCny: 912, subtotalBdt: 15002, status: "arrived_guangzhou", note: "Verified at the Guangzhou hub." }
    ],
    supplierTotalCny: 3552, supplierTotalBdt: 58430, shippingTotalCny: 608, shippingTotalBdt: 10000, totalAmountBdt: 68400, totalAmountState: "partial",
    walletCoverage: { requiredCny: 4160, reservedCny: 4160, coveredCny: 4160, uncoveredCny: 0, rateCnyToBdt: 16.45, committed: true }, favorite: { eligible: true, active: false, favoriteId: null }
  },
  {
    orderId: "order-2", productId: "product-24092", displayOrderNumber: "BC-24092", orderedAt: "2026-08-27T08:15:00.000Z", status: "received_china",
    product: { imageUrl: null, productUrl: null, shortDescription: "Home and living supplies", storeName: "Foshan home collection", storeAccount: null },
    skus: [
      { id: "sku-3", imageUrl: null, description: "Storage organizer", color: "Natural", size: "Medium", unitPriceCny: 32.6, quantity: 86, subtotalCny: 2804, subtotalBdt: 46126, status: "received_china", note: null }
    ],
    supplierTotalCny: 2608, supplierTotalBdt: 42900, shippingTotalCny: null, shippingTotalBdt: null, totalAmountBdt: 42900, totalAmountState: "estimated",
    walletCoverage: { requiredCny: 2608, reservedCny: 2608, coveredCny: 2608, uncoveredCny: 0, rateCnyToBdt: 16.45, committed: false }, favorite: { eligible: true, active: true, favoriteId: "favorite-2" }
  },
  {
    orderId: "order-3", productId: "product-24107", displayOrderNumber: "BC-24107", orderedAt: "2026-08-24T12:00:00.000Z", status: "pending_admin_review",
    product: { imageUrl: null, productUrl: null, shortDescription: "Textile accessories", storeName: "Ningbo notions market", storeAccount: null },
    skus: [
      { id: "sku-4", imageUrl: null, description: "Sewing thread bundle", color: "Mixed", size: null, unitPriceCny: 26.4, quantity: 40, subtotalCny: 1056, subtotalBdt: 17371, status: "pending_admin_review", note: "Awaiting a final estimate review." }
    ],
    supplierTotalCny: 1056, supplierTotalBdt: 17371, shippingTotalCny: null, shippingTotalBdt: null, totalAmountBdt: 31300, totalAmountState: "estimated",
    walletCoverage: { requiredCny: 1902, reservedCny: 1482, coveredCny: 1482, uncoveredCny: 420, rateCnyToBdt: 16.45, committed: false }, favorite: { eligible: false, active: false, favoriteId: null }
  }
];

export function ClientOrdersFixture() {
  return <ClientShell user={{ name: "Amina", email: "amina@example.com" }} unreadNotificationCount={3} visualPathname="/client/orders"><PageHeader eyebrow="Orders" title="Your confirmed orders" description="Track each order, selected variant, saved cost, and fulfillment status." actions={<Link href="/client/order/new" className={buttonClasses({ variant: "primary", size: "md" })}><PackagePlus aria-hidden="true" className="h-4 w-4" />New order</Link>} /><ClientOrderCards orders={orders} /></ClientShell>;
}
