import { describe, expect, it, jest } from "@jest/globals";

import { logoutOnThisDevice, updateAutoRefreshForAppState } from "@/auth/session-actions";

describe("mobile session actions", () => {
  it("logs out locally and clears secure and user-scoped state", async () => {
    const signOut = jest.fn(async () => ({ error: null }));
    const removeStoredSession = jest.fn(async () => undefined);
    const clearUserData = jest.fn();
    await logoutOnThisDevice({ signOut, removeStoredSession, clearUserData });
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(removeStoredSession).toHaveBeenCalledTimes(1);
    expect(clearUserData).toHaveBeenCalledTimes(1);
  });

  it("still clears the device when remote revocation cannot be confirmed", async () => {
    const removeStoredSession = jest.fn(async () => undefined);
    const clearUserData = jest.fn();
    await logoutOnThisDevice({
      signOut: jest.fn(async () => { throw new TypeError("offline"); }),
      removeStoredSession,
      clearUserData
    });
    expect(removeStoredSession).toHaveBeenCalledTimes(1);
    expect(clearUserData).toHaveBeenCalledTimes(1);
  });

  it("clears in-memory user data even when secure deletion fails", async () => {
    const clearUserData = jest.fn();
    await expect(logoutOnThisDevice({
      signOut: jest.fn(async () => ({ error: null })),
      removeStoredSession: jest.fn(async () => { throw new Error("keystore unavailable"); }),
      clearUserData
    })).rejects.toThrow("keystore unavailable");
    expect(clearUserData).toHaveBeenCalledTimes(1);
  });

  it("runs refresh only while the application is active", async () => {
    const client = { startAutoRefresh: jest.fn(async () => undefined), stopAutoRefresh: jest.fn(async () => undefined) };
    await updateAutoRefreshForAppState(client, "active");
    await updateAutoRefreshForAppState(client, "background");
    expect(client.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(client.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
