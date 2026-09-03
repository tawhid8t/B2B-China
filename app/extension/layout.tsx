import { requireRoleForPath } from "@/lib/auth/session";

export default async function ExtensionLayout({ children }: { children: React.ReactNode }) {
  await requireRoleForPath("/extension");
  return children;
}
