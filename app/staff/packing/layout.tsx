import { requireRoleForPath } from "@/lib/auth/session";

export default async function PackingLayout({ children }: { children: React.ReactNode }) {
  await requireRoleForPath("/staff/packing");
  return children;
}
