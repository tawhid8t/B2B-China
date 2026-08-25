import { DashboardMetric, OrderStatus } from "@/lib/types";

export const metrics: DashboardMetric[] = [
  { label: "Open orders", value: "126", detail: "18 waiting for admin review" },
  { label: "Wallet balance", value: "¥34,820", detail: "Across active clients" },
  { label: "Parcels in China", value: "72", detail: "21 need receiving scan" },
  { label: "Cartons to Guangzhou", value: "14", detail: "6 labels ready to print" }
];

export const orderPipeline: { status: OrderStatus; label: string; count: number }[] = [
  { status: "pending_admin_review", label: "Admin review", count: 18 },
  { status: "queued_for_purchase", label: "Purchase queue", count: 31 },
  { status: "seller_shipped", label: "Seller shipped", count: 44 },
  { status: "received_china", label: "Received", count: 19 },
  { status: "packed", label: "Packed", count: 14 }
];

export const recentItems = [
  {
    id: "ORD-2401",
    client: "Dhaka Trend House",
    product: "Women cotton shirt",
    image: "/placeholder-product.svg",
    status: "seller_shipped",
    estimate: "৳ 1,482",
    group: "DTH-AUG-03"
  },
  {
    id: "ORD-2402",
    client: "Chittagong Mobile Hub",
    product: "USB-C charger set",
    image: "/placeholder-product.svg",
    status: "pending_admin_review",
    estimate: "৳ 3,910",
    group: "CMH-AUG-01"
  },
  {
    id: "ORD-2403",
    client: "Sylhet Decor",
    product: "Ceramic storage jars",
    image: "/placeholder-product.svg",
    status: "received_china",
    estimate: "৳ 5,625",
    group: "SD-AUG-02"
  }
];
