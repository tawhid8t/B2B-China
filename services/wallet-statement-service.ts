import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { AuthorizationContext } from "@/lib/auth/session";

export const WALLET_TRANSACTION_TYPES = ["advance_credit", "order_debit", "refund", "adjustment", "reservation", "reservation_release"] as const;
export type WalletTransactionType = (typeof WALLET_TRANSACTION_TYPES)[number];

type StatementRow = {
  transaction_id: string; client_id: string; transaction_type: WalletTransactionType;
  amount_cny: number | string; amount_bdt: number | string; cny_to_bdt_rate: number | string;
  running_available_balance_cny: number | string; transaction_status: string;
  payment_proof_id: string | null; payment_proof_status: string | null;
  payment_claimed_bdt: number | string | null; payment_approved_bdt: number | string | null;
  order_item_id: string | null; product_link_id: string | null; product_title: string | null;
  corrects_transaction_id: string | null; cumulative_corrected_cny: number | string;
  correction_remaining_cny: number | string | null; actor_id: string | null;
  actor_name: string | null; reason: string | null; created_at: string;
  total_funds_cny: number | string; active_reserved_cny: number | string;
  available_balance_cny: number | string; total_count: number | string;
};

export type WalletTransaction = {
  id: string; clientId: string; type: WalletTransactionType;
  amountCny: number; amountBdt: number; cnyToBdtRate: number;
  runningAvailableBalanceCny: number; status: string;
  paymentProof: { id: string; status: string | null; claimedAmountBdt: number | null; approvedAmountBdt: number | null } | null;
  order: { id: string; productId: string | null; productTitle: string | null } | null;
  correctsTransactionId: string | null; cumulativeCorrectedCny: number;
  correctionRemainingCny: number | null; actor: { id: string; name: string | null } | null;
  reason: string | null; createdAt: string;
};

export type WalletStatement = {
  clientId: string;
  totals: { totalFundsCny: number; activeReservedCny: number; availableBalanceCny: number };
  transactions: WalletTransaction[];
  meta: { page: number; pageSize: number; total: number };
  filters: WalletStatementFilters;
};

export type WalletStatementFilters = {
  page: number; pageSize: number; type: WalletTransactionType | null;
  from: string | null; to: string | null;
};

export async function getWalletStatement(
  context: AuthorizationContext,
  input: { clientId?: string | null; page?: number; pageSize?: number; type?: string | null; from?: string | null; to?: string | null } = {},
): Promise<WalletStatement> {
  assertAuthorizedRole(context, ["client", "admin", "super_admin"]);
  const page = positiveInteger(input.page, 1);
  const pageSize = Math.min(5000, positiveInteger(input.pageSize, 30));
  const type = WALLET_TRANSACTION_TYPES.includes(input.type as WalletTransactionType) ? input.type as WalletTransactionType : null;
  const from = validDate(input.from);
  const to = validDate(input.to);
  const clientId = context.role === "client" ? await resolveOwnClientId(context) : input.clientId;
  if (!clientId) throw new DatabaseOperationError("Client ID is required.", "22023");

  const { data, error } = await context.supabase.rpc("get_wallet_statement", {
    p_client_id: context.role === "client" ? null : clientId,
    p_page: page, p_page_size: pageSize, p_transaction_type: type,
    p_from_date: from, p_to_date: to,
  });
  if (error) throwDatabaseError(error);
  const rows = (data ?? []) as StatementRow[];
  const totals = rows.length ? {
    totalFundsCny: Number(rows[0].total_funds_cny),
    activeReservedCny: Number(rows[0].active_reserved_cny),
    availableBalanceCny: Number(rows[0].available_balance_cny),
  } : await getWalletTotals(context, clientId);

  return {
    clientId, totals, transactions: rows.map(mapTransaction),
    meta: { page, pageSize, total: rows.length ? Number(rows[0].total_count) : 0 },
    filters: { page, pageSize, type, from, to },
  };
}

export async function createWalletAdjustment(context: AuthorizationContext, input: { clientId: string; amountCny: number; cnyToBdtRate: number; reason: string }) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase.rpc("create_wallet_adjustment", {
    p_client_id: input.clientId, p_amount_cny: input.amountCny,
    p_cny_to_bdt_rate: input.cnyToBdtRate, p_reason: input.reason,
  });
  if (error) throwDatabaseError(error);
  return mapMutation(Array.isArray(data) ? data[0] : data);
}

export async function correctWalletTransaction(context: AuthorizationContext, input: { transactionId: string; amountCny: number; reason: string }) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase.rpc("correct_wallet_transaction", {
    p_transaction_id: input.transactionId, p_amount_cny: input.amountCny, p_reason: input.reason,
  });
  if (error) throwDatabaseError(error);
  return mapMutation(Array.isArray(data) ? data[0] : data);
}

export async function getAdminWalletWorkspace(context: AuthorizationContext, input: { search?: string; clientId?: string; page?: number; type?: string | null; from?: string | null; to?: string | null }) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const search = input.search?.trim().slice(0, 100) ?? "";
  let clientQuery = context.supabase.from("clients").select("id,business_name,profile_id").order("business_name").limit(50);
  if (search) clientQuery = clientQuery.ilike("business_name", `%${escapeLike(search)}%`);
  const { data: clientRows, error } = await clientQuery;
  if (error) throwDatabaseError(error);
  const clients = clientRows ?? [];
  const profileIds = clients.map((client) => client.profile_id as string);
  const { data: profiles, error: profileError } = profileIds.length
    ? await context.supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
    : { data: [], error: null };
  if (profileError) throwDatabaseError(profileError);
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id as string, profile]));

  const clientIds = clients.map((client) => client.id as string);
  const { data: ledgerRows, error: ledgerError } = clientIds.length
    ? await context.supabase.from("wallet_transactions").select("client_id,amount_cny,transaction_type,status").in("client_id", clientIds).eq("status", "posted")
    : { data: [], error: null };
  if (ledgerError) throwDatabaseError(ledgerError);
  const balances = new Map<string, { total: number; reserved: number; available: number }>();
  for (const row of ledgerRows ?? []) {
    const current = balances.get(row.client_id as string) ?? { total: 0, reserved: 0, available: 0 };
    const amount = Number(row.amount_cny);
    current.available += amount;
    if (row.transaction_type === "reservation" || row.transaction_type === "reservation_release") current.reserved -= amount;
    else current.total += amount;
    balances.set(row.client_id as string, current);
  }
  const clientOptions = clients.map((client) => {
    const profile = profileMap.get(client.profile_id as string);
    const balance = balances.get(client.id as string) ?? { total: 0, reserved: 0, available: 0 };
    return { id: client.id as string, businessName: client.business_name as string, contact: (profile?.email as string | undefined) ?? (profile?.full_name as string | undefined) ?? null, totals: { totalFundsCny: round(balance.total), activeReservedCny: round(Math.max(balance.reserved, 0)), availableBalanceCny: round(balance.available) } };
  });
  const selectedClientId = input.clientId && clientOptions.some((client) => client.id === input.clientId) ? input.clientId : clientOptions[0]?.id;
  const [statement, currentRate] = selectedClientId ? await Promise.all([
    getWalletStatement(context, { clientId: selectedClientId, page: input.page, type: input.type, from: input.from, to: input.to }),
    getCurrentRate(context),
  ]) : [null, await getCurrentRate(context)];
  return { clients: clientOptions, selectedClientId: selectedClientId ?? null, statement, currentRate, search };
}

async function resolveOwnClientId(context: AuthorizationContext) {
  const { data, error } = await context.supabase.from("clients").select("id").eq("profile_id", context.user.id).single();
  if (error || !data?.id) throw new DatabaseOperationError("Client profile not found.", error?.code ?? "P0002");
  return data.id as string;
}
async function getWalletTotals(context: AuthorizationContext, clientId: string) {
  const { data, error } = await context.supabase.rpc("get_client_wallet_totals", { p_client_id: clientId });
  if (error) throwDatabaseError(error); const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DatabaseOperationError("Wallet totals are unavailable.", "P0002");
  return { totalFundsCny: Number(row.total_funds_cny), activeReservedCny: Number(row.active_reserved_cny), availableBalanceCny: Number(row.available_balance_cny) };
}
async function getCurrentRate(context: AuthorizationContext) {
  const { data, error } = await context.supabase.rpc("get_current_exchange_rate");
  if (error) throwDatabaseError(error); const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DatabaseOperationError("Current exchange rate is unavailable.", "P0002");
  return Number(row.cny_to_bdt);
}
function mapTransaction(row: StatementRow): WalletTransaction { return { id: row.transaction_id, clientId: row.client_id, type: row.transaction_type, amountCny: Number(row.amount_cny), amountBdt: Number(row.amount_bdt), cnyToBdtRate: Number(row.cny_to_bdt_rate), runningAvailableBalanceCny: Number(row.running_available_balance_cny), status: row.transaction_status, paymentProof: row.payment_proof_id ? { id: row.payment_proof_id, status: row.payment_proof_status, claimedAmountBdt: row.payment_claimed_bdt === null ? null : Number(row.payment_claimed_bdt), approvedAmountBdt: row.payment_approved_bdt === null ? null : Number(row.payment_approved_bdt) } : null, order: row.order_item_id ? { id: row.order_item_id, productId: row.product_link_id, productTitle: row.product_title } : null, correctsTransactionId: row.corrects_transaction_id, cumulativeCorrectedCny: Number(row.cumulative_corrected_cny), correctionRemainingCny: row.correction_remaining_cny === null ? null : Number(row.correction_remaining_cny), actor: row.actor_id ? { id: row.actor_id, name: row.actor_name } : null, reason: row.reason, createdAt: row.created_at }; }
function mapMutation(row: any) { if (!row) throw new DatabaseOperationError("Wallet transaction result is unavailable.", "P0002"); return { transactionId: row.id as string, clientId: row.client_id as string, type: row.transaction_type as WalletTransactionType, amountCny: Number(row.amount_cny), amountBdt: Number(row.amount_bdt), runningAvailableBalanceCny: Number(row.running_balance_cny) }; }
function escapeLike(value: string) { return value.replace(/[%,_]/g, (character) => `\\${character}`); }
function round(value: number) { return Math.round((value + Number.EPSILON) * 100) / 100; }
function positiveInteger(value: number | undefined, fallback: number) { return Number.isFinite(value) && Number(value) >= 1 ? Math.trunc(Number(value)) : fallback; }
function validDate(value: string | null | undefined) { return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null; }
function throwDatabaseError(error: { code?: string; message: string; details?: string; hint?: string }): never { throw new DatabaseOperationError(error.message, error.code, error.details, error.hint); }
