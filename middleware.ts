import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // Route layouts and API handlers enforce authorization with the verified
  // server session. Avoid duplicating a remote JWT validation here, which
  // otherwise delays every protected page before it can render.
  return NextResponse.next({ request });
}

export const config = { matcher: ["/client/:path*", "/staff/:path*", "/admin/:path*", "/extension/:path*"] };
