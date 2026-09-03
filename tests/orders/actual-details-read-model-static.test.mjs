import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260829180444_add_order_actual_details_read_model.sql";

test("actual order details are append-only, audited, and restricted to admins", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create table public\.order_actual_details/);
  assert.match(migration, /recorded_by uuid not null/);
  assert.match(migration, /reason text not null/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /order_actual_details_admin_insert/);
  assert.match(migration, /current_user_role\(\)\) in \('admin', 'super_admin'\)/);
  assert.match(migration, /create or replace function public\.record_order_actual_details/);
  assert.match(migration, /for update/);
  assert.match(migration, /private\.write_audit_log_internal/);
  assert.doesNotMatch(migration, /update public\.order_actual_details/i);
  assert.doesNotMatch(migration, /delete from public\.order_actual_details/i);
});

test("private statement facts retain estimate, actual, provider, warehouse, and wallet-rate sources", async () => {
  const migration = await readFile(migrationPath, "utf8");

  assert.match(migration, /create or replace view private\.client_product_statement_line_facts/);
  assert.match(migration, /security_invoker = true/);
  assert.match(migration, /has_persisted_estimate/);
  assert.match(migration, /actual_product_amount_cny/);
  assert.match(migration, /actual_local_delivery_cny/);
  assert.match(migration, /actual_weight_kg/);
  assert.match(migration, /international_shipping_rate_bdt_per_kg/);
  assert.match(migration, /wallet_rate\.cny_to_bdt_rate/);
  assert.match(migration, /revoke all on table private\.client_product_statement_line_facts/i);
});

test("the admin endpoint validates and records actual details through the audited RPC", async () => {
  const [route, service] = await Promise.all([
    readFile("app/api/admin/orders/[id]/actual-details/route.ts", "utf8"),
    readFile("services/order-actual-detail-service.ts", "utf8"),
  ]);

  assert.match(route, /authorizeApiRequest/);
  assert.match(route, /ADMIN_ROLES/);
  assert.match(route, /reason: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(route, /recordOrderActualDetails/);
  assert.match(service, /record_order_actual_details/);
  assert.doesNotMatch(service, /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
});
