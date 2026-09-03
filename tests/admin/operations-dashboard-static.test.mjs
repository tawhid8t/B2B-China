import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("admin dashboard reads real operational data and does not use mock metrics", async () => {
  const [page, service] = await Promise.all([readFile("app/admin/page.tsx", "utf8"), readFile("services/admin-operations-service.ts", "utf8")]);
  assert.match(page, /loadAdminDashboard/); assert.doesNotMatch(page, /mock-data|31 ready|9 pending/);
  assert.match(service, /from\("order_items"\)/); assert.match(service, /provider_orders/);
});
test("review actions are lifecycle-aware and server-authorized", async () => {
  const [table, route, cards] = await Promise.all([readFile("components/admin/order-table.tsx", "utf8"), readFile("app/api/admin/orders/[id]/approve/route.ts", "utf8"), readFile("components/admin/product-order-review-cards.tsx", "utf8")]);
  assert.match(table, /order\.status === "pending_admin_review"/); assert.match(table, /order\.status === "confirmed"/);
  assert.match(route, /authorizeApiRequest\(request, ADMIN_ROLES\)/); assert.match(route, /confirm_product_order_for_purchase/);
  assert.match(cards, /Confirm and queue/); assert.match(cards, /\/api\/admin\/product-orders/);
});
