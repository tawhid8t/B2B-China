import { AppButton } from "@/ui/app-button";
import { AppText } from "@/ui/app-text";
import { SurfaceCard } from "@/ui/surface-card";

export function ErrorState({ title = "Unable to continue", message, onRetry }: { title?: string; message: string; onRetry?: () => void }) {
  return (
    <SurfaceCard>
      <AppText role="label">{title}</AppText>
      <AppText tone="secondary">{message}</AppText>
      {onRetry ? <AppButton label="Try again" variant="secondary" onPress={onRetry} /> : null}
    </SurfaceCard>
  );
}
