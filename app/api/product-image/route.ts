import { NextRequest } from "next/server";

const CACHE_SECONDS = 60 * 60 * 24;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const allowedHosts = ["alicdn.com", "taobao.com", "1688.com", "tbcdn.cn"];

export async function GET(request: NextRequest) {
  const source = parseAllowedImageUrl(request.nextUrl.searchParams.get("src"));
  if (!source) return Response.json({ error: "Unsupported product image source." }, { status: 400 });

  try {
    const upstream = await fetch(source, {
      headers: { Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8" },
      next: { revalidate: CACHE_SECONDS }
    });
    const contentType = upstream.headers.get("content-type") ?? "";
    const contentLength = Number(upstream.headers.get("content-length") ?? 0);
    if (!upstream.ok || !upstream.body || !contentType.startsWith("image/") || contentLength > MAX_IMAGE_BYTES) {
      return Response.json({ error: "Product image is unavailable." }, { status: 404 });
    }

    return new Response(upstream.body, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${CACHE_SECONDS}, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`
      }
    });
  } catch {
    return Response.json({ error: "Product image is unavailable." }, { status: 502 });
  }
}

function parseAllowedImageUrl(value: string | null) {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    const isAllowedHost = allowedHosts.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
    return url.protocol === "https:" && isAllowedHost ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
