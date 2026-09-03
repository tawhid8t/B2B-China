import { paymentDecision } from "@/lib/payments/admin-review-route";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return paymentDecision(request, context, "reject");
}
