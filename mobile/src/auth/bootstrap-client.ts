import type { ClientBootstrapData } from "@/auth/contracts";
import { clientBootstrapSchema } from "@/auth/contracts";
import { ApiClient } from "@/foundation/api";

const BOOTSTRAP_TIMEOUT_MS = 10_000;

export function createClientBootstrapRequest(apiBaseUrl: string) {
  const client = new ApiClient(apiBaseUrl);
  return async (accessToken: string): Promise<ClientBootstrapData> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);
    try {
      return await client.request("client/bootstrap", clientBootstrapSchema, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }
  };
}
