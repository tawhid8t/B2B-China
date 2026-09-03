import { useAuth } from "@/auth/auth-provider";
import { AppButton } from "@/ui/app-button";
import { AppText } from "@/ui/app-text";
import { ErrorState } from "@/ui/error-state";
import { LoadingState } from "@/ui/loading-state";
import { Screen } from "@/ui/screen";

export default function StartupScreen() {
  const { status, message, retry, logout } = useAuth();
  return (
    <Screen testID="startup-screen" justify="center">
      <AppText role="eyebrow">BridgeCart</AppText>
      <AppText role="display">Secure sourcing, ready when you are.</AppText>
      {status === "initializing" ? <LoadingState label="Checking your secure session" /> : null}
      {status === "recoverable" || status === "configurationError" ? (
        <>
          <ErrorState
            title={status === "recoverable" ? "Session verification paused" : "Authentication unavailable"}
            message={message ?? "BridgeCart could not finish signing you in."}
            onRetry={() => void retry()}
          />
          <AppButton label="Log out on this device" variant="secondary" onPress={() => void logout()} />
        </>
      ) : null}
    </Screen>
  );
}
