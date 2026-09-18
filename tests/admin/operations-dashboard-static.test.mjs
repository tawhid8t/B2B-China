import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin dashboard reads real operational data and does not use mock metrics", async () => {
  const [page, service] = await Promise.all([readFile("app/admin/page.tsx", "utf8"), readFile("services/admin-operations-service.ts", "utf8")]);
  assert.match(page, /loadAdminDashboard/); assert.doesNotMatch(page, /mock-data|31 ready|9 pending/);
  assert.match(service, /from\("order_items"\)/); assert.match(service, /provider_orders/);
});
test("review actions are lifecycle-aware and server-authorized", async () => {
  const [table, route, confirmRoute, decisionRoute, cards, migration] = await Promise.all([readFile("components/admin/order-table.tsx", "utf8"), readFile("app/api/admin/orders/[id]/approve/route.ts", "utf8"), readFile("app/api/admin/product-orders/[id]/confirm/route.ts", "utf8"), readFile("app/api/admin/product-orders/[id]/decision/route.ts", "utf8"), readFile("components/admin/product-order-review-cards.tsx", "utf8"), readFile("supabase/migrations/20260907064157_phase1_product_order_review_decisions.sql", "utf8")]);
  assert.match(table, /order\.status === "pending_admin_review"/); assert.match(table, /order\.status === "confirmed"/);
  assert.match(route, /authorizeApiRequest\(request, ADMIN_ROLES\)/); assert.match(route, /confirm_product_order_for_purchase/);
  assert.match(confirmRoute, /createSupabaseAdminClient/); assert.match(confirmRoute, /confirm_product_order_for_purchase_for_profile/); assert.match(confirmRoute, /p_profile_id: authorization\.context\.user\.id/);
  assert.match(cards, /Confirm and queue/); assert.match(cards, /Reject & cancel/); assert.match(cards, /Mark exception/); assert.match(cards, /\/api\/admin\/product-orders/);
  assert.match(decisionRoute, /authorizeApiRequest\(request, ADMIN_ROLES\)/); assert.match(decisionRoute, /reason: z\.string\(\)\.trim\(\)\.min\(1\)/); assert.match(decisionRoute, /decide_product_order_review/);
  assert.match(migration, /for update/); assert.match(migration, /only a fully pending product order can receive a review decision/); assert.match(migration, /private\.change_order_status_internal/);
});
