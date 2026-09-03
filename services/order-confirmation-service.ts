import { apiError } from "@/lib/api/response";
import type { ApiErrorCode } from "@/lib/api/response";
import type { AuthorizationContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ShippingTariffItem } from "@/lib/shipping-tariffs";

type DatabaseErrorShape = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

type ConfirmOrderLineInput = {
  skuId: string;
  quantity: number;
};

type ConfirmMultiSkuOrderInput = {
  clientId?: string;
  productId: string;
  lines: ConfirmOrderLineInput[];
  estimatedUnitWeightKg: number;
  tariff: ShippingTariffItem;
  idempotencyKey: string;
};

type ConfirmMultiSkuOrderRow = {
  order_item_id: string;
  sku_id: string;
  group_id: string | null;
  group_code: string | null;
  order_status: string;
  wallet_transaction_id: string | null;
  product_cost_cny: number | string;
  estimated_total_bdt: number | string;
  wallet_balance_cny: number | string;
  product_base_cost_cny: number | string;
  grand_estimated_total_bdt: number | string;
  pending_payment: boolean;
};

type OrderWalletCoverageRow = {
  id: string;
  product_order_id: string;
  wallet_required_cny: number | string | null;
  wallet_reserved_cny: number | string;
  wallet_uncovered_cny: number | string;
  wallet_rate_cny_to_bdt: number | string | null;
  wallet_committed_cny: number | string | null;
  wallet_committed_at: string | null;
};

type ProductOrderSnapshot = {
  id: string;
  order_number: string;
  created_at: string;
};

export class OrderConfirmationError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: ApiErrorCode,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "OrderConfirmationError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function confirmMultiSkuOrder(
  context: AuthorizationContext,
  input: ConfirmMultiSkuOrderInput,
) {
  const clientId = await resolveClientId(context, input.clientId);
  const adminSupabase = createSupabaseAdminClient();
  const { data, error } = await adminSupabase.rpc("confirm_multi_sku_order", {
    p_actor_id: context.user.id,
    p_actor_role: context.role,
    p_client_id: clientId,
    p_product_link_id: input.productId,
    p_lines: input.lines.map((line) => ({
      skuId: line.skuId,
      quantity: line.quantity,
    })),
    p_estimated_unit_weight_kg: input.estimatedUnitWeightKg,
    p_international_shipping_category: input.tariff.item,
    p_international_shipping_rate_bdt_per_kg: input.tariff.rateBdtPerKg,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) throwOrderConfirmationError(error);
  const rows = Array.isArray(data) ? (data as ConfirmMultiSkuOrderRow[]) : [];
  if (!rows.length) {
    throw new OrderConfirmationError(
      "INTERNAL_ERROR",
      "Order confirmation returned no result.",
      500,
    );
  }

  const { data: coverageData, error: coverageError } = await adminSupabase
    .from("order_items")
    .select(
      "id,product_order_id,wallet_required_cny,wallet_reserved_cny,wallet_uncovered_cny,wallet_rate_cny_to_bdt,wallet_committed_cny,wallet_committed_at",
    )
    .in(
      "id",
      rows.map((row) => row.order_item_id),
    );
  if (coverageError) throwOrderConfirmationError(coverageError);
  const coverageByOrderId = new Map(
    ((coverageData ?? []) as OrderWalletCoverageRow[]).map((row) => [
      row.id,
      row,
    ]),
  );
  const coverageRows = rows.map((row) =>
    coverageByOrderId.get(row.order_item_id),
  );
  if (coverageRows.some((row) => !row)) {
    throw new OrderConfirmationError(
      "INTERNAL_ERROR",
      "Order wallet coverage could not be loaded.",
      500,
    );
  }

  const productOrderIds = [...new Set(coverageRows.map((row) => row!.product_order_id))];
  if (productOrderIds.length !== 1) {
    throw new OrderConfirmationError(
      "INTERNAL_ERROR",
      "Order confirmation did not produce one product submission.",
      500,
    );
  }
  const { data: productOrderData, error: productOrderError } = await adminSupabase
    .from("product_orders")
    .select("id,order_number,created_at")
    .eq("client_id", clientId)
    .eq("id", productOrderIds[0])
    .single();
  if (productOrderError || !productOrderData) {
    throw new OrderConfirmationError(
      "INTERNAL_ERROR",
      "Confirmed product submission could not be loaded.",
      500,
    );
  }
  const productOrder = productOrderData as ProductOrderSnapshot;

  const requiredAmountCny = coverageRows.reduce(
    (sum, row) => sum + Number(row?.wallet_required_cny ?? 0),
    0,
  );
  const reservedAmountCny = coverageRows.reduce(
    (sum, row) => sum + Number(row?.wallet_reserved_cny ?? 0),
    0,
  );
  const uncoveredAmountCny = coverageRows.reduce(
    (sum, row) => sum + Number(row?.wallet_uncovered_cny ?? 0),
    0,
  );
  const appliedRates = [
    ...new Set(
      coverageRows
        .map((row) => Number(row?.wallet_rate_cny_to_bdt ?? 0))
        .filter(Boolean),
    ),
  ];

  return {
    clientId,
    productOrderId: productOrder.id,
    orderNumber: productOrder.order_number,
    submittedAt: productOrder.created_at,
    groupId: rows[0].group_id,
    groupCode: rows[0].group_code,
    status: rows[0].order_status,
    productBaseCostCny: Number(rows[0].product_base_cost_cny),
    grandEstimatedTotalBdt: Number(rows[0].grand_estimated_total_bdt),
    walletBalanceCny: Number(
      rows.at(-1)?.wallet_balance_cny ?? rows[0].wallet_balance_cny,
    ),
    pendingPayment: uncoveredAmountCny > 0,
    requiredAmountCny,
    reservedAmountCny,
    uncoveredAmountCny,
    appliedRate: appliedRates.length === 1 ? appliedRates[0] : null,
    orderItems: rows.map((row) => ({
      ...(() => {
        const coverage = coverageByOrderId.get(row.order_item_id)!;
        return {
          requiredAmountCny: Number(coverage.wallet_required_cny ?? 0),
          reservedAmountCny: Number(coverage.wallet_reserved_cny),
          uncoveredAmountCny: Number(coverage.wallet_uncovered_cny),
          appliedRate:
            coverage.wallet_rate_cny_to_bdt === null
              ? null
              : Number(coverage.wallet_rate_cny_to_bdt),
          committedAmountCny:
            coverage.wallet_committed_cny === null
              ? null
              : Number(coverage.wallet_committed_cny),
          committed: coverage.wallet_committed_at !== null,
        };
      })(),
      orderItemId: row.order_item_id,
      groupId: row.group_id,
      groupCode: row.group_code,
      status: row.order_status,
      reservationTransactionId: row.wallet_transaction_id,
      productCostCny: Number(row.product_cost_cny),
      estimatedTotalBdt: Number(row.estimated_total_bdt),
      walletBalanceCny: Number(row.wallet_balance_cny),
      pendingPayment: row.pending_payment,
      skuId: row.sku_id,
    })),
  } as const;
}

async function resolveClientId(
  context: AuthorizationContext,
  requestedClientId?: string,
) {
  if (context.role === "client") {
    const { data, error } = await context.supabase
      .from("clients")
      .select("id")
      .eq("profile_id", context.user.id)
      .single();

    if (error || !data?.id) {
      throw new OrderConfirmationError(
        "MANUAL_REVIEW_REQUIRED",
        "Your client account is missing its business profile. Please contact support before confirming an order.",
        422,
      );
    }

    if (requestedClientId && requestedClientId !== data.id) {
      throw new OrderConfirmationError(
        "FORBIDDEN",
        "The requested client account does not match the signed-in user.",
        403,
      );
    }

    return data.id as string;
  }

  if (!requestedClientId) {
    throw new OrderConfirmationError(
      "VALIDATION_ERROR",
      "A clientId is required when confirming on behalf of a client.",
      400,
    );
  }

  return requestedClientId;
}

function throwOrderConfirmationError(error: DatabaseErrorShape): never {
  const message = error.message || "Order confirmation failed.";
  const normalized = message.toLowerCase();
  if (error.code === "42501") {
    throw new OrderConfirmationError("FORBIDDEN", message, 403);
  }
  if (error.code === "P0002") {
    throw new OrderConfirmationError("NOT_FOUND", message, 404);
  }
  if (error.code === "22023" || error.code === "22P02") {
    throw new OrderConfirmationError("VALIDATION_ERROR", message, 400, {
      databaseCode: error.code,
    });
  }
  if (
    error.code === "P0001" &&
    (normalized.includes("manual review") ||
      normalized.includes("configuration"))
  ) {
    throw new OrderConfirmationError("MANUAL_REVIEW_REQUIRED", message, 422, {
      databaseCode: error.code,
    });
  }
  if (["23505", "23514", "P0001", "P0003"].includes(error.code ?? "")) {
    throw new OrderConfirmationError("CONFLICT", message, 409, {
      databaseCode: error.code,
      hint: error.hint,
    });
  }
  throw new OrderConfirmationError("INTERNAL_ERROR", message, 500, {
    databaseCode: error.code,
    details: error.details,
    hint: error.hint,
  });
}

export function orderConfirmationErrorResponse(error: OrderConfirmationError) {
  return apiError(error.code, error.message, error.status, error.details);
}
