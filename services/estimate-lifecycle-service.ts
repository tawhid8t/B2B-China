import type { AuthorizationContext } from "../lib/auth/session.ts";

type DatabaseErrorShape = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

type AcceptEstimateRow = {
  order_item_id: string;
  group_id: string | null;
  group_code: string | null;
  order_status: "pending_admin_review";
  wallet_reservation_status: string;
  reservation_transaction_id: string | null;
  required_amount_cny: number | string;
  reserved_amount_cny: number | string;
  uncovered_amount_cny: number | string;
  wallet_balance_cny: number | string;
};

type RejectEstimateRow = {
  estimate_id: string;
  estimate_status: "rejected";
};

export type EstimateLifecycleErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "EXPIRED_ESTIMATE"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

export class EstimateLifecycleError extends Error {
  readonly code: EstimateLifecycleErrorCode;
  readonly status: number;
  readonly details: Record<string, unknown>;

  constructor(
    code: EstimateLifecycleErrorCode,
    message: string,
    status: number,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "EstimateLifecycleError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export async function acceptEstimate(
  context: AuthorizationContext,
  input: { estimateId: string; clientId: string },
) {
  assertEstimateRole(context);

  const { data, error } = await context.supabase.rpc("accept_estimate", {
    p_estimate_id: input.estimateId,
    p_client_id: input.clientId,
  });

  if (error) throwLifecycleError(error);
  const row = requireSingleRow<AcceptEstimateRow>(data, "Estimate acceptance");

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
  } as const;
}

export async function rejectEstimate(
  context: AuthorizationContext,
  input: { estimateId: string; reason: string },
) {
  assertEstimateRole(context);

  const { data, error } = await context.supabase.rpc("reject_estimate", {
    p_estimate_id: input.estimateId,
    p_reason: input.reason,
  });

  if (error) throwLifecycleError(error);
  const row = requireSingleRow<RejectEstimateRow>(data, "Estimate rejection");

  return {
    estimateId: row.estimate_id,
    status: row.estimate_status,
  } as const;
}

function assertEstimateRole(context: AuthorizationContext): void {
  if (!(["client", "admin", "super_admin"] as const).includes(
    context.role as "client" | "admin" | "super_admin",
  )) {
    throw new EstimateLifecycleError(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
      403,
    );
  }
}

function requireSingleRow<T>(data: unknown, operation: string): T {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new EstimateLifecycleError(
      "INTERNAL_ERROR",
      `${operation} returned no result.`,
      500,
    );
  }
  return row as T;
}

function throwLifecycleError(error: DatabaseErrorShape): never {
  const message = error.message || "The estimate operation could not be completed.";
  const normalized = message.toLowerCase();

  if (error.code === "42501") {
    throw new EstimateLifecycleError("FORBIDDEN", message, 403);
  }
  if (error.code === "P0002") {
    throw new EstimateLifecycleError("NOT_FOUND", message, 404);
  }
  if (normalized.includes("estimate has expired")) {
    throw new EstimateLifecycleError("EXPIRED_ESTIMATE", message, 409);
  }
  if (error.code === "22023") {
    throw new EstimateLifecycleError("VALIDATION_ERROR", message, 400);
  }
  if (error.code === "23505" || error.code === "23514" || error.code === "P0001") {
    throw new EstimateLifecycleError("CONFLICT", message, 409, {
      databaseCode: error.code,
      hint: error.hint,
    });
  }

  throw new EstimateLifecycleError("INTERNAL_ERROR", message, 500, {
    databaseCode: error.code,
  });
}
