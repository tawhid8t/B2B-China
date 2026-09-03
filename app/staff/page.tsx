import { redirect } from "next/navigation";
import { dashboardPathByRole } from "@/lib/auth/roles";
import { requireRoleForPath } from "@/lib/auth/session";

export default async function StaffPage() {
  const session = await requireRoleForPath("/staff");
  redirect(dashboardPathByRole[session.role]);
}
