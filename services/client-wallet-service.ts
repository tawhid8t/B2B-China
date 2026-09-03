import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import type { AuthorizationContext } from "@/lib/auth/session";
import { getWalletStatement, type WalletStatement } from "@/services/wallet-statement-service";

const CLIENT_ROLE = ["client"] as const;

type WalletTotalsRow = {
  total_funds_cny: number | string;
  active_reserved_cny: number | string;
  available_balance_cny: number | string;
};

type ExchangeRateRow = {
  exchange_rate_id: string;
  cny_to_bdt: number | string;
  source: string;
  effective_on: string;
};

type PaymentInstructionRow = {
  id: string;
  method: string;
  label: string;
  account_name: string | null;
  account_identifier: string | null;
  instructions: string | null;
  sort_order: number;
};

type PaymentProofRow = {
  id: string;
  amount_bdt: number | string;
  approved_amount_bdt: number | string | null;
  paid_at: string;
  status: "pending" | "needs_review" | "approved" | "rejected" | "cancelled";
  notes: string | null;
  review_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export type ClientWalletTotals = {
  totalFundsCny: number;
  activeReservedCny: number;
  availableBalanceCny: number;
};

export type CurrentExchangeRate = {
  id: string;
  cnyToBdt: number;
  source: string;
  effectiveOn: string;
};

export type ClientPaymentInstruction = {
  id: string;
  method: string;
  label: string;
  accountName: string | null;
  accountIdentifier: string | null;
  instructions: string | null;
};

export type ClientPaymentProof = {
  id: string;
  claimedAmountBdt: number;
  approvedAmountBdt: number | null;
  paidAt: string;
  status: PaymentProofRow["status"];
  notes: string | null;
  reviewReason: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type ClientPaymentHistory = {
  proofs: ClientPaymentProof[];
  total: number;
  page: number;
  pageSize: number;
};

export type ClientWalletOverview = {
  clientId: string;
  totals: ClientWalletTotals;
  exchangeRate: CurrentExchangeRate;
  paymentInstructions: ClientPaymentInstruction[];
  paymentHistory: ClientPaymentHistory;
  walletStatement: WalletStatement;
};

export type ClientOrderReviewContext = {
  clientId: string;
  totals: ClientWalletTotals;
  exchangeRate: CurrentExchangeRate;
};

export async function getClientOrderReviewContext(
  context: AuthorizationContext,
): Promise<ClientOrderReviewContext> {
  assertAuthorizedRole(context, CLIENT_ROLE);
  const clientId = await resolveOwnClientId(context);
  const [totals, exchangeRate] = await Promise.all([
    getWalletTotals(context, clientId),
    getCurrentExchangeRate(context),
  ]);
  return { clientId, totals, exchangeRate };
}

export async function getClientWalletOverview(
  context: AuthorizationContext,
  options: { paymentsPage?: number; ledgerPage?: number; type?: string | null; from?: string | null; to?: string | null } = {},
): Promise<ClientWalletOverview> {
  assertAuthorizedRole(context, CLIENT_ROLE);
  const clientId = await resolveOwnClientId(context);
  const [totals, exchangeRate, paymentInstructions, paymentHistory, walletStatement] = await Promise.all([
    getWalletTotals(context, clientId),
    getCurrentExchangeRate(context),
    getActivePaymentInstructions(context),
    getClientPaymentHistoryById(context, clientId, options.paymentsPage ?? 1),
    getWalletStatement(context, { page: options.ledgerPage, type: options.type, from: options.from, to: options.to }),
  ]);

  return { clientId, totals, exchangeRate, paymentInstructions, paymentHistory, walletStatement };
}

export async function getClientPaymentHistory(
  context: AuthorizationContext,
  page = 1,
): Promise<ClientPaymentHistory> {
  assertAuthorizedRole(context, CLIENT_ROLE);
  return getClientPaymentHistoryById(context, await resolveOwnClientId(context), page);
}

export async function getActivePaymentInstructions(
  context: AuthorizationContext,
): Promise<ClientPaymentInstruction[]> {
  const { data, error } = await context.supabase
    .from("payment_instructions")
    .select("id,method,label,account_name,account_identifier,instructions,sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throwDatabaseError(error);
  return ((data ?? []) as PaymentInstructionRow[]).map(mapInstruction);
}

export async function createClientPaymentProof(
  context: AuthorizationContext,
  input: {
    amountBdt: number;
    paidAt: string;
    proofFilePath: string;
    notes: string | null;
  },
) {
  assertAuthorizedRole(context, CLIENT_ROLE);
  const clientId = await resolveOwnClientId(context);
  const { data, error } = await context.supabase
    .from("payment_proofs")
    .insert({
      client_id: clientId,
      amount_bdt: input.amountBdt,
      paid_at: input.paidAt,
      proof_file_path: input.proofFilePath,
      notes: input.notes,
      status: "pending",
    })
    .select("id,amount_bdt,approved_amount_bdt,paid_at,status,notes,review_reason,rejection_reason,created_at,reviewed_at")
    .single();

  if (error) throwDatabaseError(error);
  return mapPaymentProof(data as PaymentProofRow);
}

export async function cancelClientPaymentProof(
  context: AuthorizationContext,
  paymentProofId: string,
) {
  assertAuthorizedRole(context, CLIENT_ROLE);
  const { data, error } = await context.supabase.rpc("cancel_own_payment_proof", {
    p_payment_proof_id: paymentProofId,
  });
  if (error) throwDatabaseError(error);

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DatabaseOperationError("Payment proof not found.", "P0002");
  return { paymentProofId: row.id as string, status: row.status as string };
}

async function resolveOwnClientId(context: AuthorizationContext) {
  const { data, error } = await context.supabase
    .from("clients")
    .select("id")
    .eq("profile_id", context.user.id)
    .single();
  if (error || !data?.id) {
    throw new DatabaseOperationError("Client profile not found.", error?.code ?? "P0002");
  }
  return data.id as string;
}

async function getWalletTotals(context: AuthorizationContext, clientId: string): Promise<ClientWalletTotals> {
  const { data, error } = await context.supabase.rpc("get_client_wallet_totals", {
    p_client_id: clientId,
  });
  if (error) throwDatabaseError(error);
  const row = requireSingleRow<WalletTotalsRow>(data, "Wallet totals");
  return {
    totalFundsCny: Number(row.total_funds_cny),
    activeReservedCny: Number(row.active_reserved_cny),
    availableBalanceCny: Number(row.available_balance_cny),
  };
}

async function getCurrentExchangeRate(context: AuthorizationContext): Promise<CurrentExchangeRate> {
  const { data, error } = await context.supabase.rpc("get_current_exchange_rate");
  if (error) throwDatabaseError(error);
  const row = requireSingleRow<ExchangeRateRow>(data, "Current exchange rate");
  return {
    id: row.exchange_rate_id,
    cnyToBdt: Number(row.cny_to_bdt),
    source: row.source,
    effectiveOn: row.effective_on,
  };
}

async function getClientPaymentHistoryById(
  context: AuthorizationContext,
  clientId: string,
  page: number,
): Promise<ClientPaymentHistory> {
  const pageSize = 20;
  const normalizedPage = Math.max(1, Math.trunc(page));
  const from = (normalizedPage - 1) * pageSize;
  const { data, error, count } = await context.supabase
    .from("payment_proofs")
    .select(
      "id,amount_bdt,approved_amount_bdt,paid_at,status,notes,review_reason,rejection_reason,created_at,reviewed_at",
      { count: "exact" },
    )
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .range(from, from + pageSize - 1);

  if (error) throwDatabaseError(error);
  return {
    proofs: ((data ?? []) as PaymentProofRow[]).map(mapPaymentProof),
    total: count ?? 0,
    page: normalizedPage,
    pageSize,
  };
}

function mapInstruction(row: PaymentInstructionRow): ClientPaymentInstruction {
  return {
    id: row.id,
    method: row.method,
    label: row.label,
    accountName: row.account_name,
    accountIdentifier: row.account_identifier,
    instructions: row.instructions,
  };
}

function mapPaymentProof(row: PaymentProofRow): ClientPaymentProof {
  return {
    id: row.id,
    claimedAmountBdt: Number(row.amount_bdt),
    approvedAmountBdt: row.approved_amount_bdt === null ? null : Number(row.approved_amount_bdt),
    paidAt: row.paid_at,
    status: row.status,
    notes: row.notes,
    reviewReason: row.review_reason,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
  };
}

function requireSingleRow<T>(data: unknown, label: string): T {
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DatabaseOperationError(`${label} are unavailable.`, "P0002");
  return row as T;
}

function throwDatabaseError(error: { code?: string; message: string; details?: string; hint?: string }): never {
  throw new DatabaseOperationError(error.message, error.code, error.details, error.hint);
}
