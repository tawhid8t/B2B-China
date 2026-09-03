import { AppShell } from "@/components/app-shell";
import { ExtensionSetupPanel } from "@/components/admin/extension-setup-panel";
import { requireRoleForPath } from "@/lib/auth/session";

export default async function AdminExtensionPage() {
  await requireRoleForPath("/admin/extension");
  return <AppShell title="Chrome Extension" eyebrow="Purchasing connection"><ExtensionSetupPanel /></AppShell>;
}
