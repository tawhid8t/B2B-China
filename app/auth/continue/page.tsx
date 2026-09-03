import { redirect } from "next/navigation";
import { dashboardPathByRole, roleCanAccessPath } from "@/lib/auth/roles";
import { safePostLoginPath } from "@/lib/auth/safe-redirect";
import { getVerifiedSessionProfile } from "@/lib/auth/session";

export default async function ContinueAfterLogin({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const session = await getVerifiedSessionProfile();
  if (!session) redirect("/auth/login");
  const requestedPath = safePostLoginPath((await searchParams).next);
  if (requestedPath && roleCanAccessPath(session.role, requestedPath)) {
    redirect(requestedPath);
  }
  redirect(dashboardPathByRole[session.role]);
}
