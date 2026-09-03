import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/api";
import { PACKING_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const cartonSchema = z.object({
  clientId: z.string(),
  category: z.string(),
  netWeightKg: z.number().nonnegative(),
  grossWeightKg: z.number().nonnegative(),
  orderItemIds: z.array(z.string()).min(1),
  shippingMark: z.string()
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, PACKING_ROLES);
  if (!authorization.authorized) return authorization.response;

  const body = cartonSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid carton payload." }, { status: 400 });

  return NextResponse.json({
    cartonId: `ctn_${Date.now()}`,
    cartonCode: `${body.data.shippingMark}-${body.data.category.toUpperCase()}-${Date.now().toString().slice(-6)}`,
    labelPath: "/labels/generated-label.pdf",
    status: "packed"
  });
}
