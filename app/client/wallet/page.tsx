import { Alert, Card, PageHeader } from "@/components/ui";
import { ClientWallet } from "@/components/client/client-wallet";
import { requireRoleForPath } from "@/lib/auth/session";
import { getClientWalletOverview } from "@/services/client-wallet-service";

export default async function ClientWalletPage({
  searchParams,
}: {
  searchParams: Promise<{ paymentsPage?: string; ledgerPage?: string; type?: string; from?: string; to?: string }>;
}) {
  const context = await requireRoleForPath("/client/wallet");
  const params = await searchParams;
  const paymentsPage = positivePage(params.paymentsPage);
  const ledgerPage = positivePage(params.ledgerPage);

  try {
    const overview = await getClientWalletOverview(context, { paymentsPage, ledgerPage, type: params.type, from: params.from, to: params.to });
    return <ClientWallet overview={overview} />;
  } catch {
    return (
      <>
        <PageHeader
          eyebrow="Wallet & payments"
          title="Your wallet"
          description="Review available funds, submit payment proof, and track admin verification."
        />
        <Card className="mt-7 p-5 sm:p-6">
          <Alert variant="danger" title="Wallet unavailable">
            Your wallet information could not be loaded. Refresh the page or try again later.
          </Alert>
        </Card>
      </>
    );
  }
}

function positivePage(value?: string) { const page = Number(value ?? "1"); return Number.isInteger(page) && page > 0 ? page : 1; }
