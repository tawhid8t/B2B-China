import { requireRoleForPath } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRoleForPath("/admin");
  return children;
}
