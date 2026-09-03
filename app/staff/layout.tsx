import { requireRoleForPath } from "@/lib/auth/session";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requireRoleForPath("/staff");
  return children;
}
