import { Suspense } from "react";
import { ClientDashboard, ClientDashboardError, ClientDashboardSkeleton } from "@/components/client/client-dashboard";
import { requireRoleForPath } from "@/lib/auth/session";
import { getClientDashboardSummary } from "@/services/client-dashboard-service";

export default function ClientPage() {
  return <Suspense fallback={<ClientDashboardSkeleton />}><DashboardContent /></Suspense>;
}

async function DashboardContent() {
  const context = await requireRoleForPath("/client");
  const fullName = typeof context.user.user_metadata.full_name === "string" ? context.user.user_metadata.full_name.trim() : "";
  const name = fullName || context.user.email?.split("@")[0] || "there";
  try {
    return <ClientDashboard name={name} summary={await getClientDashboardSummary(context)} />;
  } catch {
    return <ClientDashboardError />;
  }
}
