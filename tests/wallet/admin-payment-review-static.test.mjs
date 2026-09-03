import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260830091147_admin_payment_review_and_settings.sql");
const service = read("services/admin-payment-service.ts");
const approve = read("app/api/admin/payments/[id]/approve/route.ts");
const proof = read("app/api/admin/payments/[id]/proof/route.ts");
const rates = read("app/api/admin/settings/exchange-rates/route.ts");
const instructions = read("app/api/admin/settings/payment-instructions/route.ts");
const panel = read("components/admin/admin-payments-panel.tsx");
const settings = read("components/admin/payment-settings-panel.tsx");

test("approval is atomic, session-derived, and idempotent", () => {
  assert.match(migration, /for update/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /private\.post_wallet_transaction_internal/);
  assert.match(migration, /A retry of the same terminal decision/);
  assert.match(migration, /wallet_transactions_one_posted_credit_per_proof_idx|v_credit\.id/);
  assert.match(migration, /amount mismatch reason is required/);
  assert.doesNotMatch(approve, /approvedBy/);
});

test("all explicit payment decisions use protected review RPC", () => {
  assert.match(service, /rpc\("review_payment_proof"/);
  assert.match(service, /action: "approve" \| "reject" \| "needs_review" \| "cancel"/);
  assert.match(panel, /Approve & credit/);
  assert.match(panel, /Needs review/);
  assert.match(panel, />Reject</);
  assert.match(panel, />Cancel</);
});

test("proof preview is admin-only and short lived", () => {
  assert.match(proof, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.match(service, /createSignedUrl\(proof\.proof_file_path, 300\)/);
  assert.match(service, /expiresIn: 300/);
});

test("default rates and payment destinations are super-admin managed", () => {
  assert.match(rates, /authorizeApiRequest\(request, OWNER_ROLES\)/);
  assert.match(instructions, /authorizeApiRequest\(request, OWNER_ROLES\)/);
  assert.match(migration, /history remains append-only/i);
  assert.match(migration, /v_role <> 'super_admin'/);
  assert.match(settings, /Exchange-rate history/);
  assert.match(settings, /Payment instructions/);
});

test("review results create client notifications and preserve claims", () => {
  assert.match(migration, /insert into public\.notifications/);
  assert.match(migration, /v_proof\.amount_bdt/);
  assert.match(migration, /approved_amount_bdt = round/);
  assert.match(migration, /reviewed_by = v_actor/);
});
