import { NextResponse } from "next/server";
import { z } from "zod";

const proofSchema = z.object({
  clientId: z.string(),
  amountBdt: z.number().positive(),
  paidAt: z.string(),
  proofFilePath: z.string().optional()
});

export async function POST(request: Request) {
  const body = proofSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid payment proof." }, { status: 400 });

  return NextResponse.json({
    paymentId: `pay_${Date.now()}`,
    status: "pending_admin_approval",
    ...body.data
  });
}
