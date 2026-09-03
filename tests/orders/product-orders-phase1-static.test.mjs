import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260830221242_phase1_product_orders_pending_review.sql";

test("product orders group one submission without merging legacy repeat purchases", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /create table public\.product_orders/);
  assert.match(migration, /product_order_id uuid references public\.product_orders/);
  assert.match(migration, /confirmation:' \|\| ocr\.id::text/);
  assert.match(migration, /legacy:' \|\| oi\.id::text/);
  assert.match(migration, /order_items_assign_product_order/);
  assert.match(migration, /alter column product_order_id set not null/);
});

test("product confirmation is atomic and records both required status transitions", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /create or replace function public\.confirm_product_order_for_purchase/);
  assert.match(migration, /for update/);
  assert.match(migration, /'confirmed'/);
  assert.match(migration, /'queued_for_purchase'/);
  assert.match(migration, /insert into public\.purchase_batch_items/);
  assert.match(migration, /mixed SKU statuses and cannot be confirmed/);
});

test("client and admin read models use product-order boundaries", async () => {
  const [migration, page, route, service] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("app/admin/orders/review/page.tsx", "utf8"),
    readFile("app/api/admin/product-orders/[id]/confirm/route.ts", "utf8"),
    readFile("services/admin-operations-service.ts", "utf8"),
  ]);
  assert.match(migration, /oi\.product_order_id/);
  assert.match(migration, /product_order_id::text as order_key/);
  assert.match(page, /loadAdminPendingProductOrders/);
  assert.match(route, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.match(route, /confirm_product_order_for_purchase/);
  assert.match(service, /from\("product_orders"\)/);
});
