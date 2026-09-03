import { ClientDashboard } from "@/components/client/client-dashboard";
import { ClientShell } from "@/components/client/client-shell";
import type { ClientDashboardSummary } from "@/services/client-dashboard-service";

const summary: ClientDashboardSummary = {
  wallet: {
    availableBalanceCny: 8420,
    activeReservedCny: 1280,
    rateCnyToBdt: 16.45,
    recentTransactions: [
      {
        id: "wallet-1", clientId: "fixture-client", type: "advance_credit", amountCny: 2500, amountBdt: 41125, cnyToBdtRate: 16.45,
        runningAvailableBalanceCny: 8420, status: "completed", paymentProof: null, order: null, correctsTransactionId: null,
        cumulativeCorrectedCny: 0, correctionRemainingCny: null, actor: null, reason: "Approved account funding", createdAt: "2026-08-30T09:00:00.000Z"
      },
      {
        id: "wallet-2", clientId: "fixture-client", type: "reservation", amountCny: -1280, amountBdt: -21056, cnyToBdtRate: 16.45,
        runningAvailableBalanceCny: 5920, status: "active", paymentProof: null, order: { id: "order-1", productId: "product-1", productTitle: "Wireless accessories" },
        correctsTransactionId: null, cumulativeCorrectedCny: 0, correctionRemainingCny: null, actor: null, reason: null, createdAt: "2026-08-29T10:30:00.000Z"
      }
    ]
  },
  orders: {
    activeCount: 5,
    stages: { purchasing: 1, chinaWarehouse: 1, guangzhou: 2, bangladesh: 1, readyForPickup: 0 },
    recent: [
      { orderId: "order-1", displayOrderNumber: "BC-24081", orderedAt: "2026-08-29T10:30:00.000Z", productTitle: "Wireless accessories", productImageUrl: "/placeholder-product.svg", quantity: 42, status: "arrived_guangzhou", totalAmountCny: 4160, totalAmountBdt: 68400, totalAmountState: "partial", uncoveredCny: 0 },
      { orderId: "order-2", displayOrderNumber: "BC-24092", orderedAt: "2026-08-27T08:15:00.000Z", productTitle: "Home and living supplies", productImageUrl: "/placeholder-product.svg", quantity: 24, status: "received_china", totalAmountCny: 2608, totalAmountBdt: 42900, totalAmountState: "estimated", uncoveredCny: 0 },
      { orderId: "order-3", displayOrderNumber: "BC-24107", orderedAt: "2026-08-24T12:00:00.000Z", productTitle: "Textile accessories", productImageUrl: "/placeholder-product.svg", quantity: 18, status: "pending_admin_review", totalAmountCny: 1902, totalAmountBdt: 31300, totalAmountState: "estimated", uncoveredCny: 420 }
    ],
    exceptionCount: 1,
    uncoveredCny: 420
  },
  paymentsAwaitingReview: 1,
  notifications: {
    unread: 3,
    recent: [
      { id: "notification-1", title: "Payment proof under review", body: "Your latest funding proof is waiting for verification.", createdAt: "2026-08-30T09:00:00.000Z", readAt: null },
      { id: "notification-2", title: "Order reached Guangzhou", body: "BC-24081 has arrived at the Guangzhou hub.", createdAt: "2026-08-29T11:00:00.000Z", readAt: null }
    ]
  }
};

export function ClientDashboardFixture() {
  return <ClientShell user={{ name: "Amina", email: "amina@example.com" }} unreadNotificationCount={3} visualPathname="/client"><ClientDashboard name="Amina" summary={summary} /></ClientShell>;
}
