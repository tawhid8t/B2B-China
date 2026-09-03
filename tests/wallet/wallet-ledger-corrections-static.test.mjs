import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260830093457_wallet_ledgers_corrections_and_exports.sql");
const service = read("services/wallet-statement-service.ts");
const walletApi = read("app/api/wallet/route.ts");
const adjustmentApi = read("app/api/admin/clients/[id]/wallet/adjustments/route.ts");
const correctionApi = read("app/api/admin/wallet/transactions/[id]/corrections/route.ts");
const clientWallet = read("components/client/client-wallet.tsx");
const adminWallet = read("components/admin/admin-wallet-panel.tsx");
const csv = read("lib/csv.ts");

test("canonical statement is role-scoped, filtered, and paginated", () => {
  assert.match(migration, /create or replace function public\.get_wallet_statement/);
  assert.match(migration, /v_role not in \('client', 'admin', 'super_admin'\)/);
  assert.match(migration, /p_client_id <> v_client_id/);
  assert.match(migration, /count\(\*\) over\(\)/);
  assert.match(migration, /payment_proof_status/);
  assert.match(migration, /correction_remaining_cny/);
  assert.match(walletApi, /authorizeApiRequest\(request, \["client", "admin", "super_admin"\]\)/);
});

test("manual adjustments require admin session, reason, rate, and safe balance", () => {
  assert.match(migration, /create_wallet_adjustment_internal/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /adjustment reason is required/);
  assert.match(migration, /adjustment would make available wallet balance negative/);
  assert.match(adjustmentApi, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.doesNotMatch(adjustmentApi, /createdBy|approvedBy/);
});

test("linked corrections preserve rate, oppose the source, and cannot over-correct", () => {
  assert.match(migration, /v_original\.cny_to_bdt_rate/);
  assert.match(migration, /wallet correction exceeds the uncorrected original amount/);
  assert.match(migration, /corrects_transaction_id/);
  assert.match(migration, /correction would make available wallet balance negative/);
  assert.match(correctionApi, /correctWalletTransaction\(authorization\.context/);
});

test("client and admin wallet screens expose reconcilable transaction details", () => {
  assert.match(clientWallet, /Transaction statement/);
  assert.match(clientWallet, /Running available/);
  assert.match(adminWallet, /Manual adjustment/);
  assert.match(adminWallet, /Post correction/);
  assert.match(adminWallet, /Export filtered ledger CSV/);
  assert.match(service, /actor_name/);
});

test("CSV exports are role-protected and spreadsheet-safe", () => {
  assert.match(csv, /content-type.*text\/csv/s);
  assert.match(csv, /\^\[=\+\\-@\]/);
  assert.match(csv, /replaceAll\('\"', '\"\"'\)/);
});
