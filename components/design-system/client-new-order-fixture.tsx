import { OrderLinkResolver } from "@/components/client/order-link-resolver";
import type { ResolvedProduct } from "@/components/client/product-link-entry";
import { ClientShell } from "@/components/client/client-shell";

export function ClientNewOrderFixture({ scenario = "entry" }: { scenario?: string }) {
  const initialProduct = fixtureProduct(scenario);
  return <ClientShell user={{ name: "Amina", email: "amina@example.com" }} unreadNotificationCount={3} visualPathname="/client/order/new"><OrderLinkResolver initialUrl="" clientId="fixture-client" initialProduct={initialProduct} /></ClientShell>;
}

function fixtureProduct(scenario: string): ResolvedProduct | undefined {
  if (scenario === "entry") return undefined;
  if (scenario === "single") return {
    ...baseProduct,
    title: "Compact USB travel adapter",
    titleCn: "多功能USB旅行转换插头",
    priceMinCny: 16.5,
    priceMaxCny: 16.5,
    skus: [{ skuId: "single-sku", providerSkuId: "single", label: "Standard", attributes: {}, priceCny: 16.5, availableQuantity: 84 }]
  };
  if (scenario === "large") {
    const colors = Array.from({ length: 12 }, (_, index) => `Color ${index + 1}`);
    const sizes = Array.from({ length: 10 }, (_, index) => `${35 + index}`);
    return { ...baseProduct, title: "Large supplier catalog with many configurable combinations", skus: colors.flatMap((color, colorIndex) => sizes.map((size, sizeIndex) => ({ skuId: `large-${colorIndex}-${sizeIndex}`, providerSkuId: `large-${colorIndex}-${sizeIndex}`, label: `${color} / ${size}`, attributes: { Color: color, Size: size }, priceCny: 22 + sizeIndex * 0.5, availableQuantity: (colorIndex + sizeIndex) % 11 === 0 ? 0 : 20 + colorIndex + sizeIndex, imageUrl: `/placeholder-product.svg?color=${colorIndex}` }))) };
  }
  return baseProduct;
}

const baseProduct: ResolvedProduct = {
  productId: "fixture-product",
  provider: "alibaba1688",
  providerItemId: "816432828739",
  originalUrl: "https://detail.1688.com/offer/816432828739.html",
  title: "Professional waterproof travel organizer with reinforced compartments",
  titleCn: "跨境旅行多功能防水收纳包大容量加厚便携整理袋",
  images: ["/placeholder-product.svg?view=front", "/placeholder-product.svg?view=detail"],
  category: "Travel bags and organizers",
  domesticDeliveryCny: 6,
  priceMinCny: 18.8,
  priceMaxCny: 22.5,
  skus: [
    fixtureSku("navy-s", "Navy", "Small", 18.8, 42, "navy"),
    fixtureSku("navy-m", "Navy", "Medium", 20.2, 18, "navy"),
    fixtureSku("navy-l", "Navy", "Large", 22.5, 0, "navy"),
    fixtureSku("ivory-s", "Ivory", "Small", 18.8, 31, "ivory"),
    fixtureSku("ivory-m", "Ivory", "Medium", 20.2, 9, "ivory"),
    fixtureSku("ivory-l", "Ivory", "Large", 22.5, 4, "ivory")
  ]
};

function fixtureSku(id: string, color: string, size: string, priceCny: number, availableQuantity: number, image: string) {
  return { skuId: id, providerSkuId: id, label: `${color} / ${size}`, attributes: { Color: color, Size: size }, priceCny, availableQuantity, imageUrl: `/placeholder-product.svg?color=${image}` };
}
