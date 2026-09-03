import { AppShell } from "@/components/app-shell";
import { EmptyState } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";
export default async function ClientsPage() { await requireRoleForPath("/admin/clients"); return <AppShell title="Clients" eyebrow="Operations"> <EmptyState title="No client management actions in this phase" description="Client operations remain available through the existing order workflows." /></AppShell>; }
