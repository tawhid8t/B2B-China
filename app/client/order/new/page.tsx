import { OrderLinkResolver } from "@/components/client/order-link-resolver";
import { Alert, Card } from "@/components/ui";
import { requireRoleForPath } from "@/lib/auth/session";

export default async function NewOrderPage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const { supabase, user } = await requireRoleForPath("/client/order/new");
  const { url } = await searchParams;
  const { data: client } = await supabase
    .from("clients")
    .select("id")
    .eq("profile_id", user.id)
    .single();

  if (!client?.id) {
    return (
      <Card className="p-5 shadow-panel sm:p-6">
        <Alert variant="warning" title="Client profile required">
          Your account is signed in, but the business client profile is not ready yet. Please contact support before confirming an order.
        </Alert>
      </Card>
    );
  }

  return <OrderLinkResolver initialUrl={url ?? ""} clientId={client.id} />;
}
