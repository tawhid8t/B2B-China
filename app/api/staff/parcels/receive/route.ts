import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/api";
import { RECEIVING_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const receiveSchema = z.object({
  trackingNumber: z.string(),
  orderItemId: z.string(),
  receivedPieces: z.number().int().nonnegative(),
  weightKg: z.number().nonnegative(),
  qcStatus: z.enum(["pass", "fail", "partial", "missing"]),
  notes: z.string().optional()
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, RECEIVING_ROLES);
  if (!authorization.authorized) return authorization.response;

  const body = receiveSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid receiving payload." }, { status: 400 });

  return NextResponse.json({ parcelId: `par_${Date.now()}`, status: "received_china", ...body.data });
}
