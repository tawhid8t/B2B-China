import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AdminPaymentsPanel } from "@/components/admin/admin-payments-panel";
import { buttonClasses } from "@/components/ui/button";
import { requireRoleForPath } from "@/lib/auth/session";
import { getAdminPaymentPage } from "@/services/admin-payment-service";

export default async function AdminPaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requireRoleForPath("/admin/payments");
  const params = await searchParams;
  const page = Number(Array.isArray(params.page) ? params.page[0] : params.page) || 1;
  const status = Array.isArray(params.status) ? params.status[0] : params.status;
  const search = Array.isArray(params.search) ? params.search[0] : params.search;
  const paymentPage = await getAdminPaymentPage(context, { page, status, search });
  return (
    <AppShell title="Payment review" eyebrow="Wallet funding">
      <div className="mb-5 flex justify-end">
        {context.role === "super_admin" && <Link href="/admin/system/payments" className={buttonClasses({ variant: "outline" })}>Rates & payment instructions</Link>}
      </div>
      <AdminPaymentsPanel paymentPage={paymentPage} />
    </AppShell>
  );
}
