import { NextResponse } from "next/server";

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const allowed = (process.env.CHROME_EXTENSION_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  return allowed.includes(origin) ? origin : null;
}

export function extensionCorsResponse(request: Request, response: NextResponse) {
  const origin = allowedOrigin(request);
  if (origin) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.headers.set("Vary", "Origin");
  }
  return response;
}

export function extensionCorsPreflight(request: Request) {
  const origin = allowedOrigin(request);
  if (!origin) return NextResponse.json({ error: { code: "FORBIDDEN", message: "Extension origin is not allowed.", details: {} } }, { status: 403 });
  return extensionCorsResponse(request, new NextResponse(null, { status: 204 }));
}
