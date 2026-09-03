import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260830083912_wallet_payment_financial_foundation.sql", import.meta.url),
  "utf8",
);
const pricing = readFileSync(new URL("../../lib/pricing.ts", import.meta.url), "utf8");
const buyingInterface = readFileSync(
  new URL("../../components/client/product-detail-buying-interface.tsx", import.meta.url),
  "utf8",
);
const businessRules = readFileSync(new URL("../../docs/BUSINESS_RULES.md", import.meta.url), "utf8");

test("the financial migration is additive and establishes review fields", () => {
  assert.match(migration, /add column approved_amount_bdt numeric\(14,2\)/);
  assert.match(migration, /add column review_reason text/);
  assert.doesNotMatch(migration, /drop table|drop column/i);
});

test("linked corrections and canonical wallet totals are represented", () => {
  assert.match(migration, /add column corrects_transaction_id uuid/);
  assert.match(migration, /transaction_type in \('refund', 'adjustment'\)/);
  assert.match(migration, /create or replace function public\.get_client_wallet_totals/);
  assert.match(migration, /total_funds_cny numeric\(14,2\)/);
  assert.match(migration, /active_reserved_cny numeric\(14,2\)/);
  assert.match(migration, /available_balance_cny numeric\(14,2\)/);
});

test("payment destinations and proof storage are private and role scoped", () => {
  assert.match(migration, /create table public\.payment_instructions/);
  assert.match(migration, /payment_instructions_owner_insert/);
  assert.match(migration, /current_user_role\(\)\) = 'super_admin'/);
  assert.match(migration, /'payment-proofs',[\s\S]*false,[\s\S]*10485760/);
  assert.match(migration, /payment_proof_objects_client_insert/);
  assert.doesNotMatch(migration, /payment_proof_objects_client_(update|delete)/);
});

test("exchange-rate history is append-only and 19.2000 is effective", () => {
  assert.match(migration, /create trigger exchange_rates_append_only/);
  assert.match(migration, /19\.2000,[\s\S]*'system_default',[\s\S]*date '2026-08-30'/);
  assert.match(businessRules, /initial production default is `1 CNY = 19\.2000 BDT`/);
});

test("the order review loads the current server-authoritative rate instead of a UI default", () => {
  assert.match(pricing, /DEFAULT_EXCHANGE_RATE_CNY_TO_BDT = 19\.2/);
  assert.doesNotMatch(pricing, /DEFAULT_EXCHANGE_RATE_CNY_TO_BDT = 16\.2/);
  assert.match(buyingInterface, /fetch\("\/api\/client\/order-review-context"/);
  assert.match(buyingInterface, /exchangeRate: reviewContext\.exchangeRate\.cnyToBdt/);
  assert.doesNotMatch(buyingInterface, /DISPLAY_EXCHANGE_RATE_CNY_TO_BDT/);
});
