import { useAuth } from "@/auth/auth-provider";
import { AppButton } from "@/ui/app-button";
import { AppText } from "@/ui/app-text";
import { Screen } from "@/ui/screen";
import { SurfaceCard } from "@/ui/surface-card";

export default function AccountScreen() {
  const { identity, isRefreshing, logout } = useAuth();
  return (
    <Screen testID="client-account-screen">
      <AppText role="eyebrow">Account</AppText>
      <AppText role="title">{identity?.profile.fullName ?? "Client account"}</AppText>
      <SurfaceCard>
        <AppText role="label">Business</AppText>
        <AppText>{identity?.client.businessName ?? "—"}</AppText>
        <AppText role="label">Email</AppText>
        <AppText>{identity?.profile.email ?? "Not available"}</AppText>
        <AppText tone="secondary">Active client account</AppText>
      </SurfaceCard>
      <AppButton
        disabled={Boolean(isRefreshing)}
        label={isRefreshing ? "Logging out…" : "Log out on this device"}
        variant="secondary"
        onPress={() => void logout()}
      />
    </Screen>
  );
}
