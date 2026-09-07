export function productImageSource(src: string | null | undefined) {
  if (!src || src.startsWith("/") || src.startsWith("data:") || src.startsWith("/api/product-image")) return src;
  try {
    const source = new URL(src);
    return source.protocol === "https:" ? `/api/product-image?src=${encodeURIComponent(source.toString())}` : src;
  } catch {
    return src;
  }
}
