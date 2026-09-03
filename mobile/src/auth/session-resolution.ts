import { isAuthRetryableFetchError, type Session } from "@supabase/supabase-js";

import type { ClientBootstrapData } from "@/auth/contracts";
import { ApiClientError } from "@/foundation/api";

const REFRESH_MARGIN_SECONDS = 60;

export type SessionResolution =
  | { status: "authenticated"; session: Session; identity: ClientBootstrapData }
  | { status: "signedOut"; message?: string }
  | { status: "forbidden"; message: string }
  | { status: "recoverable"; session: Session; message: string };

type RefreshResult = { session: Session | null; error: unknown | null };

export type SessionResolutionDependencies = {
  bootstrap(accessToken: string): Promise<ClientBootstrapData>;
  refresh(): Promise<RefreshResult>;
};

export function isRetryableAuthFailure(error: unknown) {
  return isAuthRetryableFetchError(error)
    || error instanceof TypeError
    || (error instanceof ApiClientError && (error.details.status === 0 || error.details.status >= 500));
}

function shouldRefresh(session: Session) {
  return !session.expires_at || session.expires_at <= Math.floor(Date.now() / 1_000) + REFRESH_MARGIN_SECONDS;
}

async function refreshedSession(dependencies: SessionResolutionDependencies, fallback: Session) {
  let result: RefreshResult;
  try {
    result = await dependencies.refresh();
  } catch (error) {
    if (isRetryableAuthFailure(error)) return { kind: "recoverable" as const, session: fallback };
    return { kind: "signedOut" as const };
  }
  if (result.session) return { kind: "session" as const, session: result.session };
  if (result.error && isRetryableAuthFailure(result.error)) {
    return { kind: "recoverable" as const, session: fallback };
  }
  return { kind: "signedOut" as const };
}

export async function resolveClientSession(
  initialSession: Session | null,
  dependencies: SessionResolutionDependencies
): Promise<SessionResolution> {
  if (!initialSession) return { status: "signedOut" };

  let session = initialSession;
  if (shouldRefresh(session)) {
    const refreshed = await refreshedSession(dependencies, session);
    if (refreshed.kind === "recoverable") {
      return { status: "recoverable", session, message: "We could not verify your saved session. Check your connection and try again." };
    }
    if (refreshed.kind === "signedOut") {
      return { status: "signedOut", message: "Your session has expired. Sign in again." };
    }
    session = refreshed.session;
  }

  try {
    const identity = await dependencies.bootstrap(session.access_token);
    return { status: "authenticated", session, identity };
  } catch (error) {
    if (error instanceof ApiClientError && error.details.status === 403) {
      return { status: "forbidden", message: "This app is available only to active BridgeCart client accounts." };
    }
    if (error instanceof ApiClientError && error.details.status === 401) {
      const refreshed = await refreshedSession(dependencies, session);
      if (refreshed.kind === "recoverable") {
        return { status: "recoverable", session, message: "We could not verify your saved session. Check your connection and try again." };
      }
      if (refreshed.kind === "signedOut") {
        return { status: "signedOut", message: "Your session has expired. Sign in again." };
      }
      try {
        const identity = await dependencies.bootstrap(refreshed.session.access_token);
        return { status: "authenticated", session: refreshed.session, identity };
      } catch (retryError) {
        if (retryError instanceof ApiClientError && retryError.details.status === 403) {
          return { status: "forbidden", message: "This app is available only to active BridgeCart client accounts." };
        }
        if (retryError instanceof ApiClientError && retryError.details.status === 401) {
          return { status: "signedOut", message: "Your session has expired. Sign in again." };
        }
        return { status: "recoverable", session: refreshed.session, message: "BridgeCart could not verify your account. Try again shortly." };
      }
    }
    if (isRetryableAuthFailure(error)) {
      return { status: "recoverable", session, message: "We could not verify your saved session. Check your connection and try again." };
    }
    return { status: "recoverable", session, message: "BridgeCart could not verify your account. Try again shortly." };
  }
}
