import { AuthShell } from "@/components/auth/auth-shell";
import { LoadingState } from "@/components/ui";

export default function ContinueAfterLoginLoading() {
  return <AuthShell title="Restoring your session" description="Checking your active account before opening the right workspace."><LoadingState label="Restoring your session" description="This keeps protected workspaces private while your account is verified." /></AuthShell>;
}
