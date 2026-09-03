import "react-native-url-polyfill/auto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthRuntimeConfig } from "@/config/environment";
import { secureSessionStorage } from "@/foundation/secure-storage";

export function authStorageKey(appVariant: AuthRuntimeConfig["appVariant"]) {
  return `bridgecart-mobile-${appVariant}-auth`;
}

export function createMobileSupabaseClient(config: AuthRuntimeConfig): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storage: secureSessionStorage,
      storageKey: authStorageKey(config.appVariant)
    }
  });
}
