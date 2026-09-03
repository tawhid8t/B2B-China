import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import type { AuthorizationContext } from "@/lib/auth/session";
import { ORDER_STATUSES } from "@/lib/domain/constants";
import type { OrderStatus } from "@/lib/domain/types";
import { getClientOrderCards } from "@/services/client-order-cards-service";
import { getWalletStatement, type WalletTransaction } from "@/services/wallet-statement-service";

const CLIENT_ROLE = ["client"] as const;
const RECENT_LIMIT = 3;

export type DashboardOrder = {
  orderId: string;
  displayOrderNumber: string;
  orderedAt: string;
  productTitle: string;
  productImageUrl: string | null;
  quantity: number;
  status: OrderStatus;
  totalAmountCny: number | null;
  totalAmountBdt: number | null;
  totalAmountState: "actual" | "estimated" | "partial" | "unavailable";
  uncoveredCny: number;
};

export type DashboardStage = "purchasing" | "chinaWarehouse" | "guangzhou" | "bangladesh" | "readyForPickup";

export type ClientDashboardSummary = {
  wallet: { availableBalanceCny: number; activeReservedCny: number; rateCnyToBdt: number; recentTransactions: WalletTransaction[] };
  orders: { activeCount: number; stages: Record<DashboardStage, number>; recent: DashboardOrder[]; exceptionCount: number; uncoveredCny: number };
  paymentsAwaitingReview: number;
  notifications: { unread: number; recent: Array<{ id: string; title: string; body: string; createdAt: string; readAt: string | null }> };
};

export async function getClientDashboardSummary(context: AuthorizationContext): Promise<ClientDashboardSummary> {
  assertAuthorizedRole(context, CLIENT_ROLE);
  const [walletStatement, rate, orderCards, recentNotifications, unreadNotifications, pendingProofs] = await Promise.all([
    getWalletStatement(context, { pageSize: RECENT_LIMIT }),
    getCurrentRate(context),
    getClientOrderCards(context),
    context.supabase.from("notifications").select("id,title,body,created_at,read_at").order("created_at", { ascending: false }).limit(RECENT_LIMIT),
    context.supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null),
    context.supabase.from("payment_proofs").select("id", { count: "exact", head: true }).in("status", ["pending", "needs_review"]),
  ]);
  if (recentNotifications.error) throwDatabaseError(recentNotifications.error);
  if (unreadNotifications.error) throwDatabaseError(unreadNotifications.error);
  if (pendingProofs.error) throwDatabaseError(pendingProofs.error);

  const orders = orderCards.orders.flatMap(toDashboardOrder).sort((left, right) => right.orderedAt.localeCompare(left.orderedAt));
  const activeOrders = orders.filter((order) => order.status !== "completed" && order.status !== "cancelled");
  const stages: Record<DashboardStage, number> = { purchasing: 0, chinaWarehouse: 0, guangzhou: 0, bangladesh: 0, readyForPickup: 0 };
  for (const order of activeOrders) { const stage = stageFor(order.status); if (stage) stages[stage] += 1; }

  return {
    wallet: { availableBalanceCny: walletStatement.totals.availableBalanceCny, activeReservedCny: walletStatement.totals.activeReservedCny, rateCnyToBdt: rate, recentTransactions: walletStatement.transactions.slice(0, RECENT_LIMIT) },
    orders: { activeCount: activeOrders.length, stages, recent: orders.slice(0, RECENT_LIMIT), exceptionCount: orders.filter((order) => order.status === "exception").length, uncoveredCny: round(orders.reduce((total, order) => total + order.uncoveredCny, 0)) },
    paymentsAwaitingReview: pendingProofs.count ?? 0,
    notifications: { unread: unreadNotifications.count ?? 0, recent: (recentNotifications.data ?? []).map((notification) => ({ id: notification.id as string, title: notification.title as string, body: notification.body as string, createdAt: notification.created_at as string, readAt: notification.read_at as string | null })) },
  };
}

function toDashboardOrder(value: unknown): DashboardOrder[] {
  if (!isRecord(value) || !isOrderStatus(value.status) || typeof value.orderId !== "string" || typeof value.displayOrderNumber !== "string" || typeof value.orderedAt !== "string" || !isRecord(value.product)) return [];
  const totalAmountState = value.totalAmountState;
  if (totalAmountState !== "actual" && totalAmountState !== "estimated" && totalAmountState !== "partial" && totalAmountState !== "unavailable") return [];
  const skus = Array.isArray(value.skus) ? value.skus : [];
  const quantity = skus.reduce((total, sku) => total + (isRecord(sku) ? Math.max(0, numberOrZero(sku.quantity)) : 0), 0);
  return [{ orderId: value.orderId, displayOrderNumber: value.displayOrderNumber, orderedAt: value.orderedAt, productTitle: typeof value.product.shortDescription === "string" ? value.product.shortDescription : "Product details unavailable", productImageUrl: typeof value.product.imageUrl === "string" ? value.product.imageUrl : null, quantity, status: value.status, totalAmountCny: numberOrNull(value.supplierTotalCny), totalAmountBdt: numberOrNull(value.totalAmountBdt), totalAmountState, uncoveredCny: isRecord(value.walletCoverage) ? Math.max(0, numberOrZero(value.walletCoverage.uncoveredCny)) : 0 }];
}

function stageFor(status: OrderStatus): DashboardStage | null {
  if (["queued_for_purchase", "purchased", "seller_shipped"].includes(status)) return "purchasing";
  if (["received_china", "qc_checked", "packed"].includes(status)) return "chinaWarehouse";
  if (["sent_guangzhou", "arrived_guangzhou"].includes(status)) return "guangzhou";
  if (["sent_bangladesh", "arrived_bangladesh"].includes(status)) return "bangladesh";
  return status === "ready_for_pickup" ? "readyForPickup" : null;
}

async function getCurrentRate(context: AuthorizationContext) {
  const { data, error } = await context.supabase.rpc("get_current_exchange_rate");
  if (error) throwDatabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!isRecord(row) || !Number.isFinite(Number(row.cny_to_bdt))) throw new DatabaseOperationError("Current exchange rate is unavailable.", "P0002");
  return Number(row.cny_to_bdt);
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }
function isOrderStatus(value: unknown): value is OrderStatus { return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value); }
function numberOrNull(value: unknown) { const number = Number(value); return Number.isFinite(number) ? number : null; }
function numberOrZero(value: unknown) { return numberOrNull(value) ?? 0; }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function throwDatabaseError(error: { code?: string; message: string; details?: string; hint?: string }): never { throw new DatabaseOperationError(error.message, error.code, error.details, error.hint); }
