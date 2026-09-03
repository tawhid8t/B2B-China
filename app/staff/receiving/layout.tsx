import { requireRoleForPath } from "@/lib/auth/session";

export default async function ReceivingLayout({ children }: { children: React.ReactNode }) {
  await requireRoleForPath("/staff/receiving");
  return children;
}
