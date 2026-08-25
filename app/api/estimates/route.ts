import { calculateEstimate } from "@/lib/pricing";
import { NextResponse } from "next/server";
import { z } from "zod";

const estimateSchema = z.object({
  productId: z.string(),
  skuId: z.string(),
  quantity: z.number().int().positive(),
  clientId: z.string(),
  unitPriceCny: z.number().nonnegative(),
  domesticDeliveryCny: z.number().nonnegative(),
  category: z.string(),
  estimatedUnitWeightKg: z.number().positive().optional()
});

export async function POST(request: Request) {
  const body = estimateSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid estimate request.", details: body.error.flatten() }, { status: 400 });

  return NextResponse.json(calculateEstimate(body.data));
}
