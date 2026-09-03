export type DeviceLogoutDependencies = {
  signOut(options: { scope: "local" }): Promise<unknown>;
  removeStoredSession(): Promise<void>;
  clearUserData(): void;
};

export async function logoutOnThisDevice(dependencies: DeviceLogoutDependencies) {
  await dependencies.signOut({ scope: "local" }).catch(() => undefined);
  try {
    await dependencies.removeStoredSession();
  } finally {
    dependencies.clearUserData();
  }
}

export type AutoRefreshClient = {
  startAutoRefresh(): Promise<void>;
  stopAutoRefresh(): Promise<void>;
};

export function updateAutoRefreshForAppState(client: AutoRefreshClient, state: string) {
  return state === "active" ? client.startAutoRefresh() : client.stopAutoRefresh();
}
