import { AppShell } from "@/components/app-shell";
import { AdminWalletPanel } from "@/components/admin/admin-wallet-panel";
import { requireRoleForPath } from "@/lib/auth/session";
import { getAdminWalletWorkspace } from "@/services/wallet-statement-service";

export default async function AdminWalletPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const context = await requireRoleForPath("/admin/wallet");
  const raw = await searchParams;
  const param = (key: string) => Array.isArray(raw[key]) ? raw[key]?.[0] : raw[key];
  const workspace = await getAdminWalletWorkspace(context, { search: param("search"), clientId: param("clientId"), page: Number(param("page") || 1), type: param("type"), from: param("from"), to: param("to") });
  return <AppShell title="Wallet ledger" eyebrow="Financial audit"><AdminWalletPanel workspace={workspace} /></AppShell>;
}
