import { NextResponse } from "next/server";
import { z } from "zod";

const trackSchema = z.object({
  trackingNumber: z.string(),
  courier: z.string().default("manual"),
  entityType: z.enum(["parcel", "carton"]),
  entityId: z.string()
});

export async function POST(request: Request) {
  const body = trackSchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "Invalid tracking sync payload." }, { status: 400 });

  return NextResponse.json({
    trackingNumber: body.data.trackingNumber,
    status: "manual_tracking_recorded",
    checkpoints: [],
    syncedAt: new Date().toISOString()
  });
}
