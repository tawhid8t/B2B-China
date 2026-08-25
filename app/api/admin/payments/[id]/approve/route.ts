import { roundMoney } from "@/lib/pricing";
import { NextResponse } from "next/server";
import { z } from "zod";

const approveSchema = z.object({
  amountBdt: z.number().positive(),
  cnyToBdtRate: z.number().positive(),
  approvedBy: z.string()
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const body = approveSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid approval payload." }, { status: 400 });

  const { id } = await params;
  return NextResponse.json({
    paymentId: id,
    status: "approved",
    creditedCny: roundMoney(body.data.amountBdt / body.data.cnyToBdtRate),
    approvedBy: body.data.approvedBy
  });
}
