import { useNetworkStatus } from "@/foundation/network";
import { AppText } from "@/ui/app-text";
import { Screen } from "@/ui/screen";
import { SurfaceCard } from "@/ui/surface-card";

export function AuthenticatedPlaceholder({ title }: { title: string }) {
  const { isConnected } = useNetworkStatus();
  return (
    <Screen>
      <AppText role="eyebrow">BridgeCart</AppText>
      <AppText role="title">{title}</AppText>
      <SurfaceCard>
        <AppText role="label">Foundation route only</AppText>
        <AppText tone="secondary">No authenticated session, client profile, API call, or business data exists in this phase.</AppText>
      </SurfaceCard>
      {!isConnected ? <SurfaceCard><AppText tone="secondary">Offline · no data is being loaded.</AppText></SurfaceCard> : null}
    </Screen>
  );
}
