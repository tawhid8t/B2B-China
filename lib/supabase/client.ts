"use client";

import { getSupabasePublicEnv } from "@/lib/config/env";
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  const { url, anonKey } = getSupabasePublicEnv();
  return createBrowserClient(url, anonKey);
}
