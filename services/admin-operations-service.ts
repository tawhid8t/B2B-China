import type { AuthorizationContext } from "@/lib/auth/session";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";

const orderSelect = `id,status,quantity,cny_price,domestic_delivery_cny,estimated_total_bdt,created_at,
  wallet_required_cny,wallet_reserved_cny,wallet_uncovered_cny,wallet_committed_cny,wallet_committed_at,wallet_rate_cny_to_bdt,wallet_rate_adjustment_reason,
  product:product_links(title,original_url,provider,provider_item_id,images),
  sku:product_skus(label,attributes,provider_sku_id,image_url),
  client:clients(business_name)`;

export async function loadAdminOrders(
  context: AuthorizationContext,
  status?: string,
) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  let query = context.supabase
    .from("order_items")
    .select(orderSelect)
    .order("created_at", { ascending: false })
    .limit(100);
  if (status) query = query.eq("status", status);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

const productOrderSelect = `id,order_number,created_at,
  product:product_links(title,original_url,provider,provider_item_id,images),
  client:clients(business_name),
  order_items(id,status,quantity,cny_price,domestic_delivery_cny,estimated_total_bdt,
    wallet_required_cny,wallet_reserved_cny,wallet_uncovered_cny,wallet_committed_cny,wallet_committed_at,wallet_rate_cny_to_bdt,
    sku:product_skus(label,attributes,provider_sku_id,image_url))`;

export async function loadAdminPendingProductOrders(context: AuthorizationContext) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase
    .from("product_orders")
    .select(productOrderSelect)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []).filter((order: any) =>
    order.order_items?.length > 0 &&
    order.order_items.every((item: any) => item.status === "pending_admin_review"),
  );
}

const purchaseTaskSelect = `id,state,cart_added_at,cart_added_by,last_error,created_at,updated_at,
  product_order:product_orders(id,order_number,created_at,
    product:product_links(title,original_url,provider,provider_item_id,images),
    client:clients(business_name),
    order_items(id,status,quantity,cny_price,domestic_delivery_cny,estimated_total_bdt,
      sku:product_skus(label,attributes,provider_sku_id,image_url)))`;

export async function loadAdminPurchaseTasks(context: AuthorizationContext) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase
    .from("purchase_tasks")
    .select(purchaseTaskSelect)
    .in("state", ["queued", "cart_added", "awaiting_provider_details", "awaiting_admin_confirmation", "needs_review"])
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? [])
    .filter((task: any) => (task.product_order?.order_items ?? []).length > 0)
    .map((task: any) => {
      const lines = task.product_order.order_items;
      return {
        ...task,
        hasMixedSkuStatuses: !lines.every(
          (line: any) => line.status === "queued_for_purchase",
        ),
      };
    });
}

export async function loadAdminOrder(
  context: AuthorizationContext,
  orderItemId: string,
) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase
    .from("order_items")
    .select(`${orderSelect},actual_total_bdt,cost_snapshot,wallet_committed_by`)
    .eq("id", orderItemId)
    .maybeSingle();
  if (error) throw error;
  return data as any;
}

export async function loadAdminDashboard(context: AuthorizationContext) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const [
    pending,
    queued,
    purchased,
    exceptions,
    recentOrders,
    recentPurchases,
    financialSummary,
    reconciliation,
  ] = await Promise.all([
    context.supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending_admin_review"),
    context.supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "queued_for_purchase"),
    context.supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "purchased"),
    context.supabase
      .from("order_items")
      .select("id", { count: "exact", head: true })
      .eq("status", "exception"),
    loadAdminOrders(context),
    context.supabase
      .from("provider_orders")
      .select(
        "id,provider,provider_order_id,paid_amount_cny,provider_status,synced_at,order_item:order_items(quantity,cny_price,product:product_links(title,images))",
      )
      .order("synced_at", { ascending: false })
      .limit(8),
    context.supabase.rpc("get_admin_financial_dashboard").single(),
    context.supabase.rpc("get_wallet_reconciliation").single(),
  ]);
  const error = [pending, queued, purchased, exceptions, recentPurchases, financialSummary, reconciliation].find(
    (result) => result.error,
  )?.error;
  if (error) throw error;
  return {
    counts: {
      pending: pending.count ?? 0,
      queued: queued.count ?? 0,
      purchased: purchased.count ?? 0,
      exceptions: exceptions.count ?? 0,
    },
    recentOrders: recentOrders.slice(0, 8),
    recentPurchases: recentPurchases.data ?? [],
    financial: mapFinancialSummary(financialSummary.data),
    reconciliation: mapReconciliation(reconciliation.data),
  };
}

function mapFinancialSummary(value: any) {
  return {
    pendingPaymentProofs: Number(value?.pending_payment_proofs ?? 0),
    needsReviewPaymentProofs: Number(value?.needs_review_payment_proofs ?? 0),
    clientCount: Number(value?.client_count ?? 0),
    clientsWithBalance: Number(value?.clients_with_balance ?? 0),
    totalClientFundsCny: Number(value?.total_client_funds_cny ?? 0),
    totalReservedCny: Number(value?.total_reserved_cny ?? 0),
    totalAvailableCny: Number(value?.total_available_cny ?? 0),
    uncoveredOrderCount: Number(value?.uncovered_order_count ?? 0),
    uncoveredOrderCny: Number(value?.uncovered_order_cny ?? 0),
  };
}

function mapReconciliation(value: any) {
  return {
    negativeAvailableWallets: Number(value?.negative_available_wallets ?? 0),
    approvedProofsWithoutOneCredit: Number(value?.approved_proofs_without_one_credit ?? 0),
    overcorrectedTransactions: Number(value?.overcorrected_transactions ?? 0),
    invalidOrderCoverage: Number(value?.invalid_order_coverage ?? 0),
  };
}

export async function loadPurchasedOrders(context: AuthorizationContext) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase
    .from("provider_orders")
    .select(
      `
    id,provider,provider_order_id,provider_sku_id,quantity_purchased,paid_amount_cny,actual_unit_price_cny,
    actual_domestic_delivery_cny,seller_tracking_number,provider_status,synced_at,
    order_item:order_items(id,quantity,cny_price,domestic_delivery_cny,estimated_total_bdt,product:product_links(title,images),client:clients(business_name))
  `,
    )
    .order("synced_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}
