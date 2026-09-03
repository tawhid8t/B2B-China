import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260830222626_phase2_purchase_tasks_grouped_queue.sql";

test("purchase tasks are persisted, product-wide, and admin-RLS protected", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /create table public\.purchase_tasks/);
  assert.match(migration, /product_order_id uuid not null unique/);
  assert.match(migration, /purchase_batch_id uuid not null unique/);
  assert.match(migration, /alter table public\.purchase_tasks enable row level security/);
  assert.match(migration, /purchase_tasks_admin_select/);
  assert.match(migration, /purchase_batch_items_create_product_task/);
  assert.match(migration, /'cart_added'/);
  assert.match(migration, /'needs_review'/);
});

test("cart results require the complete product SKU set and support credentials", async () => {
  const migration = await readFile(migrationPath, "utf8");
  const route = await readFile("app/api/extension/purchase-cart-result/route.ts", "utf8");
  assert.match(migration, /cart result must include every queued SKU line exactly once/);
  assert.match(migration, /record_purchase_task_cart_result_for_credential/);
  assert.match(migration, /grant execute on function public\.record_purchase_task_cart_result_for_credential[\s\S]*to service_role/);
  assert.match(route, /authorizeExtensionApiRequest/);
  assert.match(route, /skuResults/);
  assert.match(route, /cartAdded/);
  assert.match(route, /extensionCorsResponse/);
});

test("admin queue reads grouped tasks and exposes persisted task states", async () => {
  const [page, cards, service, route] = await Promise.all([
    readFile("app/admin/purchasing/page.tsx", "utf8"),
    readFile("components/admin/purchase-task-cards.tsx", "utf8"),
    readFile("services/admin-operations-service.ts", "utf8"),
    readFile("app/api/admin/purchasing/[id]/state/route.ts", "utf8"),
  ]);
  assert.match(page, /loadAdminPurchaseTasks/);
  assert.match(cards, /Added to cart — waiting for provider details/);
  assert.match(cards, /Retry purchase/);
  assert.match(cards, /Needs review/);
  assert.match(cards, /SKU status repair required/);
  assert.match(service, /from\("purchase_tasks"\)/);
  assert.match(service, /hasMixedSkuStatuses/);
  assert.match(route, /set_purchase_task_state/);
  assert.match(route, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
});
