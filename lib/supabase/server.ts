import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { getSupabasePublicEnv } from "@/lib/config/env";
import { cookies } from "next/headers";

export async function createSupabaseServerClient(request?: Request) {
  const cookieStore = await cookies();
  const { url, anonKey } = getSupabasePublicEnv();
  const authorization = request?.headers.get("authorization");

  return createServerClient(url, anonKey, {
    global: authorization ? { headers: { Authorization: authorization } } : undefined,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
      }
    }
  });
}
