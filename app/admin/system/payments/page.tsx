import { AppShell } from "@/components/app-shell";
import { PaymentSettingsPanel } from "@/components/admin/payment-settings-panel";
import { requireRoleForPath } from "@/lib/auth/session";
import { getPaymentSettings } from "@/services/admin-payment-service";

export default async function PaymentSettingsPage() {
  const context = await requireRoleForPath("/admin/system/payments");
  const settings = await getPaymentSettings(context);
  return <AppShell title="Payment settings" eyebrow="Super admin"><PaymentSettingsPanel settings={settings} /></AppShell>;
}
