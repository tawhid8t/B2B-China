import { NextResponse } from "next/server";
import { authorizeApiRequest } from "@/lib/auth/api";
import { WAREHOUSE_ROLES } from "@/lib/auth/roles";
import { z } from "zod";

const trackSchema = z.object({
  trackingNumber: z.string(),
  courier: z.string().default("manual"),
  entityType: z.enum(["parcel", "carton"]),
  entityId: z.string()
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, WAREHOUSE_ROLES);
  if (!authorization.authorized) return authorization.response;

  const body = trackSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid tracking sync payload." }, { status: 400 });

  return NextResponse.json({
    trackingNumber: body.data.trackingNumber,
    status: "manual_tracking_recorded",
    checkpoints: [],
    syncedAt: new Date().toISOString()
  });
}
