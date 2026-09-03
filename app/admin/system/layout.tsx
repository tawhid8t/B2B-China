import { requireRoleForPath } from "@/lib/auth/session";

export default async function SystemManagementLayout({ children }: { children: React.ReactNode }) {
  await requireRoleForPath("/admin/system");
  return children;
}
