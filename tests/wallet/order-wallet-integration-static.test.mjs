import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath =
  "supabase/migrations/20260830095615_integrate_orders_with_partial_wallet_reservations.sql";

test("Phase 5 uses partial reservations and audited, idempotent purchase commitment", async () => {
  const sql = await readFile(migrationPath, "utf8");
  assert.match(
    sql,
    /greatest\(least\(v_wallet_balance, v_line_product_cost\), 0\)/,
  );
  assert.match(sql, /'reservation'/);
  assert.match(sql, /v_debited := least\(v_reserved, v_actual\)/);
  assert.match(sql, /v_uncovered := greatest\(v_actual - v_debited, 0\)/);
  assert.match(sql, /exchange-rate override reason is required/);
  assert.match(
    sql,
    /purchase commitment retry conflicts with the settled paid amount/,
  );
  assert.match(sql, /wallet_committed_at/);
  assert.match(
    sql,
    /create or replace function public\.get_client_order_cards/,
  );
});

test("Phase 5 APIs and order screens expose coverage without negative-balance language", async () => {
  const [route, confirmation, clientOrders, adminOrders, providerRoute] =
    await Promise.all([
      readFile("app/api/orders/confirm/route.ts", "utf8"),
      readFile("services/order-confirmation-service.ts", "utf8"),
      readFile("components/client/client-order-cards.tsx", "utf8"),
      readFile("components/admin/order-table.tsx", "utf8"),
      readFile("app/api/extension/provider-order-sync/route.ts", "utf8"),
    ]);
  assert.match(route, /reservedAmountCny/);
  assert.match(route, /uncoveredAmountCny/);
  assert.doesNotMatch(route, /wallet balance is negative/i);
  assert.match(confirmation, /wallet_rate_cny_to_bdt/);
  assert.match(clientOrders, /Payment still required/);
  assert.match(adminOrders, /Wallet coverage/);
  assert.match(providerRoute, /rateAdjustmentReason/);
});
