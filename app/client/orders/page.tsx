import { ArrowRight, PackageCheck, PackagePlus } from "lucide-react";
import Link from "next/link";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { buttonClasses } from "@/components/ui/button";
import { ClientOrderCards } from "@/components/client/client-order-cards";
import { requireRoleForPath } from "@/lib/auth/session";
import { getClientOrderCards } from "@/services/client-order-cards-service";

export default async function ClientOrdersPage() {
  const context = await requireRoleForPath("/client/orders");
  try {
    const result = await getClientOrderCards(context);
    return <><PageHeader eyebrow="Orders" title="Your confirmed orders" description="Track each order, selected variant, saved cost, and fulfillment status." actions={<Link href="/client/order/new" className={buttonClasses({ variant: "primary", size: "md" })}><PackagePlus aria-hidden="true" className="h-4 w-4" />New order</Link>} />
      {result.orders.length === 0 ? <EmptyState title="No confirmed orders yet" description="Once you confirm a product selection, it will appear here with its status and cost snapshot." icon={<PackageCheck aria-hidden="true" className="h-5 w-5" />} action={<Link href="/client/order/new" className={buttonClasses({ variant: "primary", size: "md" })}>Start an order <ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>} /> : <ClientOrderCards orders={result.orders} />}</>;
  } catch {
    return <><PageHeader eyebrow="Orders" title="Your confirmed orders" description="Track each order, selected variant, saved cost, and fulfillment status." /><Card className="mt-7 p-5 shadow-panel sm:p-6"><Alert variant="danger" title="Orders unavailable">We could not load your orders right now. Refresh the page or try again later.</Alert></Card></>;
  }
}
