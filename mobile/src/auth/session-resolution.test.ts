import { describe, expect, it, jest } from "@jest/globals";
import type { Session } from "@supabase/supabase-js";

import type { ClientBootstrapData } from "@/auth/contracts";
import { resolveClientSession, type SessionResolutionDependencies } from "@/auth/session-resolution";
import { ApiClientError } from "@/foundation/api";

const identity: ClientBootstrapData = {
  profile: { id: "11111111-1111-4111-8111-111111111111", email: "client@example.com", fullName: "Client", role: "client", status: "active" },
  client: { id: "22222222-2222-4222-8222-222222222222", businessName: "Client Business" }
};

function session(expiresAt = Math.floor(Date.now() / 1_000) + 3_600, token = "access-token"): Session {
  return {
    access_token: token,
    refresh_token: "refresh-token",
    expires_in: 3_600,
    expires_at: expiresAt,
    token_type: "bearer",
    user: { id: identity.profile.id } as Session["user"]
  };
}

const unusedRefresh: SessionResolutionDependencies["refresh"] = async () => ({ session: null, error: null });
const unusedBootstrap: SessionResolutionDependencies["bootstrap"] = async () => identity;

describe("resolveClientSession", () => {
  it("restores a valid client session", async () => {
    const bootstrap = jest.fn(async () => identity);
    const result = await resolveClientSession(session(), { bootstrap, refresh: unusedRefresh });
    expect(result.status).toBe("authenticated");
    expect(bootstrap).toHaveBeenCalledWith("access-token");
  });

  it("returns signed out when no session exists", async () => {
    const result = await resolveClientSession(null, { bootstrap: unusedBootstrap, refresh: unusedRefresh });
    expect(result).toEqual({ status: "signedOut" });
  });

  it("refreshes an expired session before bootstrap", async () => {
    const refreshed = session(undefined, "new-access-token");
    const bootstrap = jest.fn(async () => identity);
    const result = await resolveClientSession(session(1), {
      bootstrap,
      refresh: jest.fn(async () => ({ session: refreshed, error: null }))
    });
    expect(result.status).toBe("authenticated");
    expect(bootstrap).toHaveBeenCalledWith("new-access-token");
  });

  it("preserves the stored session when verification has a network failure", async () => {
    const stored = session();
    const result = await resolveClientSession(stored, {
      bootstrap: jest.fn(async () => { throw new TypeError("offline"); }),
      refresh: unusedRefresh
    });
    expect(result).toMatchObject({ status: "recoverable", session: stored });
  });

  it("preserves an expired stored session when refresh throws a network failure", async () => {
    const stored = session(1);
    const result = await resolveClientSession(stored, {
      bootstrap: unusedBootstrap,
      refresh: async () => { throw new TypeError("offline"); }
    });
    expect(result).toMatchObject({ status: "recoverable", session: stored });
  });

  it("refreshes once after a bootstrap 401", async () => {
    const refreshed = session(undefined, "new-token");
    const bootstrap = jest.fn(async (token: string) => {
      if (token === "access-token") throw new ApiClientError({ code: "UNAUTHORIZED", message: "Expired", status: 401 });
      return identity;
    });
    const result = await resolveClientSession(session(), {
      bootstrap,
      refresh: jest.fn(async () => ({ session: refreshed, error: null }))
    });
    expect(result.status).toBe("authenticated");
    expect(bootstrap).toHaveBeenCalledTimes(2);
  });

  it("blocks a non-client account", async () => {
    const result = await resolveClientSession(session(), {
      bootstrap: jest.fn(async () => { throw new ApiClientError({ code: "FORBIDDEN", message: "Denied", status: 403 }); }),
      refresh: unusedRefresh
    });
    expect(result.status).toBe("forbidden");
  });
});
