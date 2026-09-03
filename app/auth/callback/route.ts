import { createServerClient, type SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublicEnv } from "@/lib/config/env";
import { safePostLoginPath } from "@/lib/auth/safe-redirect";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next");
  const next = requestedNext === "/auth/update-password" ? requestedNext : safePostLoginPath(requestedNext);
  url.pathname = next || "/auth/continue";
  url.search = "";

  if (!code) {
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }

  let response = NextResponse.redirect(url);
  const { url: supabaseUrl, anonKey } = getSupabasePublicEnv();
  const supabase = createServerClient(supabaseUrl, anonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.redirect(url);
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      }
    }
  });
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    url.pathname = "/auth/login";
    return NextResponse.redirect(url);
  }
  return response;
}
