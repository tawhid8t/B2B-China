import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260827144700_seed_default_cny_bdt_exchange_rate.sql",
  "utf8"
);

test("seeds the configured default CNY to BDT rate for Phase 6B confirmation", () => {
  assert.match(migration, /insert into public\.exchange_rates \(/);
  assert.match(migration, /19\.2000/);
  assert.match(migration, /'system_default'/);
  assert.match(migration, /date '2026-08-27'/);
});

test("default exchange-rate seed preserves history on conflict", () => {
  assert.match(migration, /on conflict \(effective_on, source\) do nothing/);
  assert.doesNotMatch(migration, /do update/i);
  assert.doesNotMatch(migration, /wallet_transactions/i);
});
