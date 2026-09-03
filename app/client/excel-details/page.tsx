import { ClientProductStatement } from "@/components/client/client-product-statement";
import { requireRoleForPath } from "@/lib/auth/session";

export default async function ClientExcelDetailsPage() {
  await requireRoleForPath("/client/excel-details");
  return <ClientProductStatement />;
}
