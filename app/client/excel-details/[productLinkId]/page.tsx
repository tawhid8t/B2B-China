import { ClientProductStatementDetail } from "@/components/client/client-product-statement-detail";
import { requireRoleForPath } from "@/lib/auth/session";

export default async function ClientProductStatementDetailPage({ params }: { params: Promise<{ productLinkId: string }> }) {
  await requireRoleForPath("/client/excel-details");
  const { productLinkId } = await params;
  return <ClientProductStatementDetail productLinkId={productLinkId} />;
}
