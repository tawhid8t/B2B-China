import type { ClientBootstrapData } from "@bridgecart/contracts";
import { isAuthRetryableFetchError, isAuthSessionMissingError, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { createContext, type PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";

import { createClientBootstrapRequest } from "@/auth/bootstrap-client";
import { logoutOnThisDevice, updateAutoRefreshForAppState } from "@/auth/session-actions";
import { isRetryableAuthFailure, resolveClientSession, type SessionResolution } from "@/auth/session-resolution";
import { authStorageKey, createMobileSupabaseClient } from "@/auth/supabase-client";
import { getRuntimeConfig, requireAuthRuntimeConfig, type AuthRuntimeConfig } from "@/config/environment";
import { clearUserScopedQueries } from "@/foundation/query-client";
import { secureSessionStorage, SecureSessionStorageError } from "@/foundation/secure-storage";

export type AuthStatus = "initializing" | "signedOut" | "signingIn" | "authenticated" | "recoverable" | "forbidden" | "configurationError";

type AuthState = {
  status: AuthStatus;
  identity: ClientBootstrapData | null;
  message?: string;
  isRefreshing?: boolean;
};

type AuthContextValue = AuthState & {
  signIn(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
  retry(): Promise<void>;
  returnToSignIn(): void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function loadAuthRuntimeConfig(): { config: AuthRuntimeConfig; error?: never } | { config?: never; error: string } {
  try {
    return { config: requireAuthRuntimeConfig(getRuntimeConfig()) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Mobile authentication is not configured." };
  }
}

function loginErrorMessage(error: unknown) {
  if (isAuthRetryableFetchError(error) || error instanceof TypeError) {
    return "BridgeCart could not be reached. Check your connection and try again.";
  }
  return "The email or password is incorrect.";
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [runtime] = useState(loadAuthRuntimeConfig);
  const clientRef = useRef<SupabaseClient | null>(runtime.config ? createMobileSupabaseClient(runtime.config) : null);
  const bootstrapRef = useRef(runtime.config ? createClientBootstrapRequest(runtime.config.apiBaseUrl) : null);
  const sessionRef = useRef<Session | null>(null);
  const verificationRef = useRef<Promise<void> | null>(null);
  const initializedRef = useRef(false);
  const [state, setState] = useState<AuthState>(() => runtime.error
    ? { status: "configurationError", identity: null, message: runtime.error }
    : { status: "initializing", identity: null });

  const clearLocalSession = useCallback(async (client: SupabaseClient, config: AuthRuntimeConfig) => {
    await logoutOnThisDevice({
      signOut: (options) => client.auth.signOut(options),
      removeStoredSession: () => secureSessionStorage.removeItem(authStorageKey(config.appVariant)),
      clearUserData: clearUserScopedQueries
    });
    sessionRef.current = null;
  }, []);

  const applyResolution = useCallback(async (resolution: SessionResolution, client: SupabaseClient, config: AuthRuntimeConfig) => {
    if (resolution.status === "authenticated") {
      sessionRef.current = resolution.session;
      setState({ status: "authenticated", identity: resolution.identity });
      return;
    }
    if (resolution.status === "recoverable") {
      sessionRef.current = resolution.session;
      setState({ status: "recoverable", identity: null, message: resolution.message });
      return;
    }

    await clearLocalSession(client, config).catch(() => undefined);
    setState({ status: resolution.status, identity: null, message: resolution.message });
  }, [clearLocalSession]);

  const verify = useCallback(async (session: Session | null, foreground = false) => {
    const client = clientRef.current;
    const bootstrap = bootstrapRef.current;
    const config = runtime.config;
    if (!client || !bootstrap || !config) return;
    if (verificationRef.current) return verificationRef.current;

    const operation = (async () => {
      if (!foreground) setState((current) => ({ ...current, status: current.status === "signingIn" ? "signingIn" : "initializing", message: undefined }));
      else setState((current) => current.status === "authenticated" ? { ...current, isRefreshing: true } : current);

      const resolution = await resolveClientSession(session, {
        bootstrap,
        refresh: async () => {
          const { data, error } = await client.auth.refreshSession();
          return { session: data.session, error };
        }
      });
      await applyResolution(resolution, client, config);
    })().finally(() => {
      verificationRef.current = null;
    });
    verificationRef.current = operation;
    return operation;
  }, [applyResolution, runtime.config]);

  const restore = useCallback(async (foreground = false) => {
    const client = clientRef.current;
    if (!client || !runtime.config) return;
    try {
      const { data, error } = await client.auth.getSession();
      const storageFailure = secureSessionStorage.consumeFailure();
      if (error) {
        if (sessionRef.current && isRetryableAuthFailure(error)) {
          setState({ status: "recoverable", identity: null, message: "We could not verify your saved session. Check your connection and try again." });
          return;
        }
        if (isAuthSessionMissingError(error)) {
          setState({ status: "signedOut", identity: null });
          return;
        }
        throw error;
      }
      if (storageFailure && !data.session) {
        setState({ status: "signedOut", identity: null, message: "Your saved session could not be restored. Sign in again." });
        return;
      }
      sessionRef.current = data.session;
      await verify(data.session, foreground);
    } catch (error) {
      setState({
        status: "configurationError",
        identity: null,
        message: error instanceof Error ? error.message : "Secure session storage is unavailable."
      });
    }
  }, [runtime.config, verify]);

  useEffect(() => {
    const client = clientRef.current;
    if (!client || !runtime.config) return;

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      sessionRef.current = session;
      if (event === "SIGNED_OUT" && initializedRef.current) {
        setState((current) => current.status === "forbidden" ? current : { status: "signedOut", identity: null });
      }
    });

    void updateAutoRefreshForAppState(client.auth, AppState.currentState);

    void restore().finally(() => {
      initializedRef.current = true;
    });

    const appStateListener = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void updateAutoRefreshForAppState(client.auth, nextState);
        if (initializedRef.current) void restore(true);
      } else {
        void updateAutoRefreshForAppState(client.auth, nextState);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
      appStateListener.remove();
      void updateAutoRefreshForAppState(client.auth, "inactive");
    };
  }, [restore, runtime.config]);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = clientRef.current;
    if (!client) {
      setState({ status: "configurationError", identity: null, message: runtime.error ?? "Mobile authentication is not configured." });
      return;
    }
    setState({ status: "signingIn", identity: null });
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      const storageFailure = secureSessionStorage.consumeFailure();
      if (storageFailure) {
        setState({ status: "configurationError", identity: null, message: storageFailure.message });
        return;
      }
      if (error || !data.session) {
        setState({ status: "signedOut", identity: null, message: loginErrorMessage(error) });
        return;
      }
      sessionRef.current = data.session;
      await verify(data.session);
    } catch (error) {
      if (error instanceof SecureSessionStorageError) {
        setState({ status: "configurationError", identity: null, message: error.message });
      } else {
        setState({ status: "signedOut", identity: null, message: loginErrorMessage(error) });
      }
    }
  }, [runtime.error, verify]);

  const logout = useCallback(async () => {
    const client = clientRef.current;
    const config = runtime.config;
    if (!client || !config) {
      setState({ status: "signedOut", identity: null });
      return;
    }
    setState((current) => ({ ...current, isRefreshing: true }));
    try {
      await clearLocalSession(client, config);
      setState({ status: "signedOut", identity: null });
    } catch (error) {
      setState({
        status: "configurationError",
        identity: null,
        message: error instanceof Error ? error.message : "The secure session could not be removed."
      });
    }
  }, [clearLocalSession, runtime.config]);

  const retry = useCallback(async () => {
    await restore();
  }, [restore]);

  const returnToSignIn = useCallback(() => {
    setState({ status: "signedOut", identity: null });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, signIn, logout, retry, returnToSignIn }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider.");
  return context;
}
