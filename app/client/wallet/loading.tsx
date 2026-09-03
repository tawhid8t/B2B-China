import { LoadingState, PageHeader } from "@/components/ui";

export default function ClientWalletLoading() {
  return (
    <>
      <PageHeader
        eyebrow="Wallet & payments"
        title="Your wallet"
        description="Review available funds, submit payment proof, and track admin verification."
      />
      <LoadingState className="mt-7" label="Loading wallet" description="Retrieving your protected wallet records." />
    </>
  );
}
