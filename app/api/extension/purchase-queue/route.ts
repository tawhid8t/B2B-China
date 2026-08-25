import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    items: [
      {
        orderItemId: "ORD-2401",
        provider: "alibaba1688",
        productUrl: "https://detail.1688.com/offer/123456789.html",
        skuId: "black-m",
        attributes: { color: "Black", size: "M" },
        quantity: 12
      }
    ]
  });
}
