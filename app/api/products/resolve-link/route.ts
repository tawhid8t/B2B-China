import { resolveProductFromOtapi } from "@/services/otapi-service";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({ url: z.string().url() });

export async function POST(request: Request) {
  const body = bodySchema.safeParse(await request.json());
  if (!body.success) return NextResponse.json({ error: "A valid product URL is required." }, { status: 400 });

  try {
    const product = await resolveProductFromOtapi(body.data.url);
    return NextResponse.json(product);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to resolve product." }, { status: 422 });
  }
}
