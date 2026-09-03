import { Badge, type BadgeVariant } from "@/components/ui/badge";
import type { OrderStatus } from "@/lib/domain/types";

const statusPresentation: Record<OrderStatus, { label: string; variant: BadgeVariant }> = {
  pending_admin_review: { label: "Under review", variant: "warning" },
  confirmed: { label: "Confirmed", variant: "commerce" },
  queued_for_purchase: { label: "Ready to purchase", variant: "commerce" },
  purchased: { label: "Purchased", variant: "info" },
  seller_shipped: { label: "Supplier shipped", variant: "info" },
  received_china: { label: "Received in China", variant: "success" },
  qc_checked: { label: "Quality checked", variant: "success" },
  packed: { label: "Packed", variant: "gold" },
  sent_guangzhou: { label: "Sent to Guangzhou", variant: "gold" },
  arrived_guangzhou: { label: "At Guangzhou hub", variant: "gold" },
  sent_bangladesh: { label: "On the way to Bangladesh", variant: "info" },
  arrived_bangladesh: { label: "Arrived in Bangladesh", variant: "success" },
  ready_for_pickup: { label: "Ready for pickup", variant: "commerce" },
  completed: { label: "Completed", variant: "success" },
  cancelled: { label: "Cancelled", variant: "neutral" },
  exception: { label: "Needs attention", variant: "danger" }
};

export function StatusBadge({ status, className }: { status: OrderStatus; className?: string }) {
  const presentation = statusPresentation[status];
  return <Badge data-ui="status-badge" data-status={status} variant={presentation.variant} className={className}>{presentation.label}</Badge>;
}

export function getClientStatusLabel(status: OrderStatus) {
  return statusPresentation[status].label;
}
