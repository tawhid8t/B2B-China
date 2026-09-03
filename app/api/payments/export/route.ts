import { authorizeApiRequest } from "@/lib/auth/api";
import { apiError } from "@/lib/api/response";
import { csvResponse } from "@/lib/csv";

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, ["client"]);
  if (!authorization.authorized) return authorization.response;
  const { data: client, error: clientError } = await authorization.context.supabase.from("clients").select("id").eq("profile_id", authorization.context.user.id).single();
  if (clientError || !client?.id) return apiError("NOT_FOUND", "Client profile not found.", 404);
  const rows: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await authorization.context.supabase.from("payment_proofs").select("id,amount_bdt,approved_amount_bdt,paid_at,status,notes,review_reason,rejection_reason,reviewed_at,created_at").eq("client_id", client.id).order("created_at", { ascending: false }).range(from, from + 999);
    if (error) return apiError("INTERNAL_ERROR", "Payment history export could not be created.", 500);
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) break;
  }
  return csvResponse(`payment-history-${new Date().toISOString().slice(0, 10)}.csv`, ["Payment proof ID","Claimed BDT","Approved BDT","Paid date","Status","Client note","Review reason","Reviewed at","Submitted at"], rows.map((row) => [row.id,row.amount_bdt,row.approved_amount_bdt,row.paid_at,row.status,row.notes,row.rejection_reason || row.review_reason,row.reviewed_at,row.created_at]));
}
