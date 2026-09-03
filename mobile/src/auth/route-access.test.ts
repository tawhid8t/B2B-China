import { describe, expect, it } from "@jest/globals";

import { authRouteAccess } from "@/auth/route-access";

describe("authRouteAccess", () => {
  it("opens client routes only after server-verified authentication", () => {
    expect(authRouteAccess("authenticated")).toEqual({ startup: false, signedOut: false, client: true });
    expect(authRouteAccess("signedOut").client).toBe(false);
    expect(authRouteAccess("recoverable").client).toBe(false);
    expect(authRouteAccess("forbidden").client).toBe(false);
  });
});
