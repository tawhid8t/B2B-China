import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dashboardPathByRole, isUserRole, roleCanAccessPath } from "@/lib/auth/roles";
import type { UserRole } from "@/lib/domain/types";
import type { UserMetadata } from "@supabase/supabase-js";

export type VerifiedAuthUser = {
  id: string;
  email?: string;
  user_metadata: UserMetadata;
};

export type AuthorizationContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: VerifiedAuthUser;
  role: UserRole;
};

export type AuthorizationResolution =
  | { status: "authorized"; context: AuthorizationContext }
  | { status: "unauthenticated" }
  | { status: "forbidden" };

export async function resolveAuthorizationContext(request?: Request): Promise<AuthorizationResolution> {
  const supabase = await createSupabaseServerClient(request);
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (claimsError || !claims?.sub) return { status: "unauthenticated" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", claims.sub)
    .single();

  if (profileError || !isUserRole(profile?.role) || profile.status !== "active") {
    return { status: "forbidden" };
  }

  return {
    status: "authorized",
    context: {
      supabase,
      user: {
        id: claims.sub,
        email: claims.email,
        user_metadata: claims.user_metadata ?? {}
      },
      role: profile.role
    }
  };
}

export async function getVerifiedSessionProfile(request?: Request) {
  const resolution = await resolveAuthorizationContext(request);
  return resolution.status === "authorized" ? resolution.context : null;
}

const getCachedServerAuthorizationContext = cache(async () => resolveAuthorizationContext());

export async function requireRoleForPath(pathname: string) {
  const resolution = await getCachedServerAuthorizationContext();
  if (resolution.status === "unauthenticated") redirect(`/auth/login?next=${encodeURIComponent(pathname)}`);
  if (resolution.status === "forbidden") redirect("/auth/forbidden");
  if (!roleCanAccessPath(resolution.context.role, pathname)) redirect("/auth/forbidden");
  return resolution.context;
}
