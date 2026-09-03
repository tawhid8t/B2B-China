import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import type { AuthorizationContext } from "@/lib/auth/session";

const ADMIN_ROLES = ["admin", "super_admin"] as const;
const OWNER_ROLES = ["super_admin"] as const;
export const PAYMENT_STATUSES = ["pending", "needs_review", "approved", "rejected", "cancelled"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

type ProofRow = {
  id: string; client_id: string; amount_bdt: number | string;
  approved_amount_bdt: number | string | null; paid_at: string;
  proof_file_path: string | null; status: PaymentStatus; notes: string | null;
  review_reason: string | null; rejection_reason: string | null;
  reviewed_by: string | null; reviewed_at: string | null;
  created_at: string; updated_at: string;
};

export type AdminPayment = {
  id: string; clientId: string; clientName: string; clientContact: string | null;
  claimedAmountBdt: number; approvedAmountBdt: number | null; paidAt: string;
  status: PaymentStatus; notes: string | null; reviewReason: string | null;
  rejectionReason: string | null; reviewerName: string | null;
  reviewedAt: string | null; createdAt: string;
};

export type AdminPaymentPage = {
  payments: AdminPayment[]; total: number; page: number; pageSize: number;
  currentRate: number; status: PaymentStatus | "all"; search: string;
};

export async function getAdminPaymentPage(
  context: AuthorizationContext,
  filters: { page?: number; status?: string; search?: string } = {},
): Promise<AdminPaymentPage> {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = 20;
  const status = PAYMENT_STATUSES.includes(filters.status as PaymentStatus)
    ? filters.status as PaymentStatus : "all";
  const search = filters.search?.trim().slice(0, 100) ?? "";

  let matchingClientIds: string[] | undefined;
  if (search) {
    const { data, error } = await context.supabase
      .from("clients").select("id").ilike("business_name", `%${escapeLike(search)}%`).limit(100);
    if (error) throwDatabaseError(error);
    matchingClientIds = (data ?? []).map((row) => row.id as string);
    if (!matchingClientIds.length) {
      return { payments: [], total: 0, page, pageSize, currentRate: await getCurrentRate(context), status, search };
    }
  }

  let query = context.supabase
    .from("payment_proofs")
    .select("id,client_id,amount_bdt,approved_amount_bdt,paid_at,proof_file_path,status,notes,review_reason,rejection_reason,reviewed_by,reviewed_at,created_at,updated_at", { count: "exact" })
    .order("created_at", { ascending: false });
  if (status !== "all") query = query.eq("status", status);
  if (matchingClientIds) query = query.in("client_id", matchingClientIds);
  const from = (page - 1) * pageSize;
  const { data, error, count } = await query.range(from, from + pageSize - 1);
  if (error) throwDatabaseError(error);
  const proofs = (data ?? []) as ProofRow[];

  const clientIds = [...new Set(proofs.map((proof) => proof.client_id))];
  const reviewerIds = [...new Set(proofs.flatMap((proof) => proof.reviewed_by ? [proof.reviewed_by] : []))];
  const [{ data: clients, error: clientsError }, { data: reviewers, error: reviewersError }] = await Promise.all([
    clientIds.length
      ? context.supabase.from("clients").select("id,business_name,profile_id").in("id", clientIds)
      : Promise.resolve({ data: [], error: null }),
    reviewerIds.length
      ? context.supabase.from("profiles").select("id,full_name,email").in("id", reviewerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (clientsError) throwDatabaseError(clientsError);
  if (reviewersError) throwDatabaseError(reviewersError);

  const profileIds = (clients ?? []).map((client) => client.profile_id as string);
  const { data: clientProfiles, error: profilesError } = profileIds.length
    ? await context.supabase.from("profiles").select("id,full_name,email").in("id", profileIds)
    : { data: [], error: null };
  if (profilesError) throwDatabaseError(profilesError);

  const clientMap = new Map((clients ?? []).map((client) => [client.id as string, client]));
  const profileMap = new Map((clientProfiles ?? []).map((profile) => [profile.id as string, profile]));
  const reviewerMap = new Map((reviewers ?? []).map((profile) => [profile.id as string, profile]));

  return {
    payments: proofs.map((proof) => {
      const client = clientMap.get(proof.client_id);
      const profile = client ? profileMap.get(client.profile_id as string) : undefined;
      const reviewer = proof.reviewed_by ? reviewerMap.get(proof.reviewed_by) : undefined;
      return {
        id: proof.id,
        clientId: proof.client_id,
        clientName: (client?.business_name as string | undefined) ?? (profile?.full_name as string | undefined) ?? "Unknown client",
        clientContact: (profile?.email as string | null | undefined) ?? null,
        claimedAmountBdt: Number(proof.amount_bdt),
        approvedAmountBdt: proof.approved_amount_bdt === null ? null : Number(proof.approved_amount_bdt),
        paidAt: proof.paid_at,
        status: proof.status,
        notes: proof.notes,
        reviewReason: proof.review_reason,
        rejectionReason: proof.rejection_reason,
        reviewerName: (reviewer?.full_name as string | undefined) ?? (reviewer?.email as string | undefined) ?? null,
        reviewedAt: proof.reviewed_at,
        createdAt: proof.created_at,
      };
    }),
    total: count ?? 0, page, pageSize, currentRate: await getCurrentRate(context), status, search,
  };
}

export async function reviewPaymentProof(
  context: AuthorizationContext,
  input: { paymentProofId: string; action: "approve" | "reject" | "needs_review" | "cancel"; verifiedAmountBdt?: number; cnyToBdtRate?: number; reason?: string },
) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase.rpc("review_payment_proof", {
    p_payment_proof_id: input.paymentProofId,
    p_action: input.action,
    p_verified_amount_bdt: input.verifiedAmountBdt ?? null,
    p_cny_to_bdt_rate: input.cnyToBdtRate ?? null,
    p_reason: input.reason?.trim() || null,
  });
  if (error) throwDatabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DatabaseOperationError("Payment review result is unavailable.", "P0002");
  return {
    paymentProofId: row.payment_proof_id as string,
    status: row.payment_status as PaymentStatus,
    claimedAmountBdt: Number(row.claimed_amount_bdt),
    approvedAmountBdt: row.approved_amount_bdt === null ? null : Number(row.approved_amount_bdt),
    cnyToBdtRate: row.cny_to_bdt_rate === null ? null : Number(row.cny_to_bdt_rate),
    creditedCny: row.credited_cny === null ? null : Number(row.credited_cny),
    walletTransactionId: row.wallet_transaction_id as string | null,
    reviewedBy: row.reviewed_by as string | null,
    reviewedAt: row.reviewed_at as string | null,
  };
}

export async function createPaymentProofSignedUrl(context: AuthorizationContext, paymentProofId: string) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data: proof, error } = await context.supabase
    .from("payment_proofs").select("proof_file_path").eq("id", paymentProofId).single();
  if (error || !proof?.proof_file_path) throw new DatabaseOperationError("Payment proof file not found.", error?.code ?? "P0002");
  const { data, error: signedError } = await context.supabase.storage
    .from("payment-proofs").createSignedUrl(proof.proof_file_path, 300);
  if (signedError || !data?.signedUrl) throw new DatabaseOperationError("Payment proof preview could not be created.", signedError?.name);
  return { signedUrl: data.signedUrl, expiresIn: 300 };
}

export async function getPaymentSettings(context: AuthorizationContext) {
  assertAuthorizedRole(context, OWNER_ROLES);
  const [{ data: rates, error: ratesError }, { data: instructions, error: instructionsError }] = await Promise.all([
    context.supabase.from("exchange_rates").select("id,cny_to_bdt,source,effective_on,created_at,created_by").order("effective_on", { ascending: false }).order("created_at", { ascending: false }).limit(100),
    context.supabase.from("payment_instructions").select("id,method,label,account_name,account_identifier,instructions,active,sort_order,created_at,updated_at").order("sort_order").order("created_at"),
  ]);
  if (ratesError) throwDatabaseError(ratesError);
  if (instructionsError) throwDatabaseError(instructionsError);
  return {
    rates: (rates ?? []).map((rate) => ({ ...rate, cny_to_bdt: Number(rate.cny_to_bdt) })),
    instructions: instructions ?? [],
  };
}

export async function createExchangeRate(context: AuthorizationContext, input: { cnyToBdt: number; effectiveOn: string; source: string }) {
  assertAuthorizedRole(context, OWNER_ROLES);
  const { data, error } = await context.supabase.rpc("create_exchange_rate", {
    p_cny_to_bdt: input.cnyToBdt, p_effective_on: input.effectiveOn, p_source: input.source,
  });
  if (error) throwDatabaseError(error);
  return Array.isArray(data) ? data[0] : data;
}

export async function createPaymentInstruction(context: AuthorizationContext, input: PaymentInstructionInput) {
  assertAuthorizedRole(context, OWNER_ROLES);
  const { data, error } = await context.supabase.from("payment_instructions").insert({
    method: input.method, label: input.label, account_name: input.accountName,
    account_identifier: input.accountIdentifier, instructions: input.instructions,
    active: input.active, sort_order: input.sortOrder,
    created_by: context.user.id, updated_by: context.user.id,
  }).select().single();
  if (error) throwDatabaseError(error);
  return data;
}

export async function updatePaymentInstruction(context: AuthorizationContext, id: string, input: Partial<PaymentInstructionInput>) {
  assertAuthorizedRole(context, OWNER_ROLES);
  const values: Record<string, unknown> = { updated_by: context.user.id };
  if (input.method !== undefined) values.method = input.method;
  if (input.label !== undefined) values.label = input.label;
  if (input.accountName !== undefined) values.account_name = input.accountName;
  if (input.accountIdentifier !== undefined) values.account_identifier = input.accountIdentifier;
  if (input.instructions !== undefined) values.instructions = input.instructions;
  if (input.active !== undefined) values.active = input.active;
  if (input.sortOrder !== undefined) values.sort_order = input.sortOrder;
  const { data, error } = await context.supabase.from("payment_instructions").update(values).eq("id", id).select().single();
  if (error) throwDatabaseError(error);
  return data;
}

export type PaymentInstructionInput = {
  method: string; label: string; accountName: string | null;
  accountIdentifier: string | null; instructions: string | null;
  active: boolean; sortOrder: number;
};

async function getCurrentRate(context: AuthorizationContext) {
  const { data, error } = await context.supabase.rpc("get_current_exchange_rate");
  if (error) throwDatabaseError(error);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new DatabaseOperationError("Current exchange rate is unavailable.", "P0002");
  return Number(row.cny_to_bdt);
}

function escapeLike(value: string) { return value.replace(/[%,_]/g, (character) => `\\${character}`); }
function throwDatabaseError(error: { code?: string; message: string; details?: string; hint?: string }): never {
  throw new DatabaseOperationError(error.message, error.code, error.details, error.hint);
}
