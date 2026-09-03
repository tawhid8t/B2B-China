import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const proofRoute = read("app/api/payments/proof/route.ts");
const historyRoute = read("app/api/payments/route.ts");
const cancelRoute = read("app/api/payments/[id]/cancel/route.ts");
const service = read("services/client-wallet-service.ts");
const walletPage = read("app/client/wallet/page.tsx");
const walletComponent = read("components/client/client-wallet.tsx");
const clientShell = read("components/client/client-shell.tsx");
const migration = read("supabase/migrations/20260830085536_client_wallet_funding_flow.sql");

test("proof submission is multipart, client-only, and session-derived", () => {
  assert.match(proofRoute, /request\.formData\(\)/);
  assert.match(proofRoute, /authorizeApiRequest\(request, \["client"\]\)/);
  assert.match(proofRoute, /authorization\.context\.user\.id/);
  assert.doesNotMatch(proofRoute, /formData\.get\("clientId"\)|clientId:/);
  assert.doesNotMatch(proofRoute, /Date\.now\(\).*payment|pay_\$\{Date\.now/);
});

test("proof files have exact type, size, path, and no-upsert protections", () => {
  assert.match(proofRoute, /PAYMENT_PROOF_MAX_BYTES/);
  assert.match(proofRoute, /isPaymentProofMimeType\(proof\.type\)/);
  assert.match(proofRoute, /paymentProofObjectPath\(authorization\.context\.user\.id/);
  assert.match(proofRoute, /upsert: false/);
  assert.match(proofRoute, /removeOrphanedProof\(proofFilePath\)/);
});

test("client history and cancellation remain role and ownership scoped", () => {
  assert.match(historyRoute, /authorizeApiRequest\(request, \["client"\]\)/);
  assert.match(cancelRoute, /cancelClientPaymentProof\(authorization\.context/);
  assert.match(service, /eq\("profile_id", context\.user\.id\)/);
  assert.match(service, /rpc\("cancel_own_payment_proof"/);
  assert.doesNotMatch(cancelRoute, /createSupabaseAdminClient/);
});

test("wallet page exposes live totals, instructions, funding, and history", () => {
  assert.match(walletPage, /getClientWalletOverview/);
  assert.match(walletComponent, /Available balance/);
  assert.match(walletComponent, /Payment destinations/);
  assert.match(walletComponent, /Submit payment proof/);
  assert.match(walletComponent, /Payment history/);
  assert.match(clientShell, /href: "\/client\/wallet"/);
  assert.doesNotMatch(clientShell, /"Wallet & payments", "Notifications"/);
});

test("available balance remains readable on the emphasized dark summary card", () => {
  assert.match(walletComponent, /!bg-action-primary/);
  assert.match(walletComponent, /className=\{emphasized \? "mt-2 !text-on-action \[&_span\]:!text-on-action\/70"/);
});

test("database phase provides protected current-rate, notification, and cancellation behavior", () => {
  assert.match(migration, /create or replace function public\.get_current_exchange_rate/);
  assert.match(migration, /create trigger payment_proofs_notify_admins/);
  assert.match(migration, /create or replace function private\.cancel_own_payment_proof_internal/);
  assert.match(migration, /c\.profile_id = v_actor/);
  assert.match(migration, /only a pending payment proof can be cancelled by its client/);
});
