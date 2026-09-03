import type { AuthStatus } from "@/auth/auth-provider";

export function authRouteAccess(status: AuthStatus) {
  return {
    startup: status === "initializing" || status === "recoverable" || status === "configurationError",
    signedOut: status === "signedOut" || status === "signingIn" || status === "forbidden",
    client: status === "authenticated"
  };
}
