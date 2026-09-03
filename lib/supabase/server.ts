import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "@/lib/config/env";

export async function createSupabaseServerClient(_request?: Request) {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();
  const authorization = _request?.headers.get("authorization");

  return createServerClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. Middleware refreshes them.
        }
      }
    }
  });
}
