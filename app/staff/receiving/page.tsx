import { AppShell } from "@/components/app-shell";
import { CainiaoCollectionDashboard } from "@/components/staff/cainiao-collection-dashboard";
import { CainiaoManualImport } from "@/components/staff/cainiao-manual-import";
import { CainiaoScreenshotImport } from "@/components/staff/cainiao-screenshot-import";
import { CainiaoUnmatchedReview } from "@/components/staff/cainiao-unmatched-review";

export default function ReceivingPage() {
  return (
    <AppShell title="Cainiao parcel import" eyebrow="Mobile collection intake">
      <CainiaoManualImport />
      <CainiaoScreenshotImport />
      <CainiaoCollectionDashboard />
      <CainiaoUnmatchedReview />
    </AppShell>
  );
}
