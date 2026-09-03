import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { ADMIN_ROLES, CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import type { AuthorizationContext } from "@/lib/auth/session";
import type { ExtensionCredentialContext } from "@/lib/auth/extension-api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus, WalletReservationStatus } from "@/lib/domain/types";

type DatabaseErrorShape = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

type AcceptEstimateRow = {
  order_item_id: string;
  group_id: string;
  group_code: string;
  order_status: OrderStatus;
  wallet_reservation_status: WalletReservationStatus;
  reservation_transaction_id: string | null;
  required_amount_cny: number | string;
  reserved_amount_cny: number | string;
  uncovered_amount_cny: number | string;
  wallet_balance_cny: number | string;
};

type ProviderSyncRow = {
  provider_order_record_id: string;
  order_item_status: OrderStatus;
  synced_at: string;
  reservation_transaction_id: string | null;
  release_transaction_id: string | null;
  debit_transaction_id: string | null;
  debited_amount_cny: number | string;
  uncovered_amount_cny: number | string;
  applied_rate: number | string;
};

function throwDatabaseError(error: DatabaseErrorShape): never {
  throw new DatabaseOperationError(
    error.message,
    error.code,
    error.details,
    error.hint,
  );
}

function requireSingleRow<T>(data: T | T[] | null, operation: string): T {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new DatabaseOperationError(`${operation} returned no result.`);
  }
  return row;
}

export async function acceptEstimateWithReservation(
  context: AuthorizationContext,
  input: { estimateId: string; clientId: string },
) {
  assertAuthorizedRole(context, CLIENT_OPERATION_ROLES);
  const { supabase } = context;
  const { data, error } = await supabase.rpc("accept_estimate", {
    p_estimate_id: input.estimateId,
    p_client_id: input.clientId,
  });

  if (error) throwDatabaseError(error);
  const row = requireSingleRow(
    data as AcceptEstimateRow[] | null,
    "Estimate acceptance",
  );

  return {
    orderItemId: row.order_item_id,
    groupId: row.group_id,
    groupCode: row.group_code,
    status: row.order_status,
    walletReservationStatus: row.wallet_reservation_status,
    reservationTransactionId: row.reservation_transaction_id,
    requiredAmountCny: Number(row.required_amount_cny),
    reservedAmountCny: Number(row.reserved_amount_cny),
    uncoveredAmountCny: Number(row.uncovered_amount_cny),
    walletBalanceCny: Number(row.wallet_balance_cny),
  };
}

export async function syncProviderOrderAndCommitWallet(
  context: AuthorizationContext,
  input: {
    orderItemId: string;
    provider: string;
    providerOrderId: string;
    paidAmountCny: number;
    sellerTrackingNumber?: string;
    providerStatus: string;
    rawPayload?: Record<string, unknown>;
    cnyToBdtRate?: number;
    rateAdjustmentReason?: string;
    purchaseBatchId?: string;
    providerSkuId?: string;
    quantityPurchased?: number;
    actualUnitPriceCny?: number;
    actualProductSubtotalCny?: number;
    actualDomesticDeliveryCny?: number;
    actualDiscountCny?: number;
    purchasedAt?: string;
  },
) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { supabase } = context;
  const { data, error } = await supabase.rpc(
    "sync_provider_order_and_commit_wallet_v2",
    {
      p_order_item_id: input.orderItemId,
      p_provider: input.provider,
      p_provider_order_id: input.providerOrderId,
      p_paid_amount_cny: input.paidAmountCny,
      p_seller_tracking_number: input.sellerTrackingNumber ?? null,
      p_provider_status: input.providerStatus,
      p_raw_payload: {
        ...(input.rawPayload ?? {}),
        ...(input.rateAdjustmentReason
          ? { rateAdjustmentReason: input.rateAdjustmentReason }
          : {}),
      },
      p_cny_to_bdt_rate: input.cnyToBdtRate ?? null,
      p_purchase_batch_id: input.purchaseBatchId ?? null,
      p_provider_sku_id: input.providerSkuId ?? null,
      p_quantity_purchased: input.quantityPurchased ?? null,
      p_actual_unit_price_cny: input.actualUnitPriceCny ?? null,
      p_actual_product_subtotal_cny: input.actualProductSubtotalCny ?? null,
      p_actual_domestic_delivery_cny: input.actualDomesticDeliveryCny ?? null,
      p_actual_discount_cny: input.actualDiscountCny ?? null,
      p_purchased_at: input.purchasedAt ?? null,
    },
  );

  if (error) throwDatabaseError(error);
  const row = requireSingleRow(
    data as ProviderSyncRow[] | null,
    "Provider order sync",
  );

  return {
    providerOrderId: row.provider_order_record_id,
    orderItemStatus: row.order_item_status,
    syncedAt: row.synced_at,
    reservationTransactionId: row.reservation_transaction_id,
    reservationReleaseTransactionId: row.release_transaction_id,
    walletDebitTransactionId: row.debit_transaction_id,
    debitedAmountCny: Number(row.debited_amount_cny),
    uncoveredAmountCny: Number(row.uncovered_amount_cny),
    appliedRate: Number(row.applied_rate),
  };
}

export async function syncProviderOrderAndCommitWalletForExtensionCredential(
  context: ExtensionCredentialContext,
  input: Parameters<typeof syncProviderOrderAndCommitWallet>[1],
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc(
    "sync_provider_order_and_commit_wallet_for_credential",
    {
      p_profile_id: context.profileId,
      p_order_item_id: input.orderItemId,
      p_provider: input.provider,
      p_provider_order_id: input.providerOrderId,
      p_paid_amount_cny: input.paidAmountCny,
      p_seller_tracking_number: input.sellerTrackingNumber ?? null,
      p_provider_status: input.providerStatus,
      p_raw_payload: {
        ...(input.rawPayload ?? {}),
        ...(input.rateAdjustmentReason
          ? { rateAdjustmentReason: input.rateAdjustmentReason }
          : {}),
      },
      p_cny_to_bdt_rate: input.cnyToBdtRate ?? null,
      p_purchase_batch_id: input.purchaseBatchId ?? null,
      p_provider_sku_id: input.providerSkuId ?? null,
      p_quantity_purchased: input.quantityPurchased ?? null,
      p_actual_unit_price_cny: input.actualUnitPriceCny ?? null,
      p_actual_product_subtotal_cny: input.actualProductSubtotalCny ?? null,
      p_actual_domestic_delivery_cny: input.actualDomesticDeliveryCny ?? null,
      p_actual_discount_cny: input.actualDiscountCny ?? null,
      p_purchased_at: input.purchasedAt ?? null,
    },
  );
  if (error) throwDatabaseError(error);
  const row = requireSingleRow(
    data as ProviderSyncRow[] | null,
    "Provider order sync",
  );
  return {
    providerOrderId: row.provider_order_record_id,
    orderItemStatus: row.order_item_status,
    syncedAt: row.synced_at,
    reservationTransactionId: row.reservation_transaction_id,
    reservationReleaseTransactionId: row.release_transaction_id,
    walletDebitTransactionId: row.debit_transaction_id,
    debitedAmountCny: Number(row.debited_amount_cny),
    uncoveredAmountCny: Number(row.uncovered_amount_cny),
    appliedRate: Number(row.applied_rate),
  };
}
