import { AppShell } from "@/components/app-shell";
import { PurchaseTaskCards } from "@/components/admin/purchase-task-cards";
import { requireRoleForPath } from "@/lib/auth/session";
import { loadAdminPurchaseTasks } from "@/services/admin-operations-service";
export default async function PurchasingPage() { const context = await requireRoleForPath("/admin/purchasing"); const tasks = await loadAdminPurchaseTasks(context); return <AppShell title="Purchase queue" eyebrow="Product-wide extension tasks"><PurchaseTaskCards tasks={tasks as any[]} /></AppShell>; }
