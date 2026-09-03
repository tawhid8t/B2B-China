import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("favorites use owned eligible order items and preserve history", async () => {
  const [migration, postRoute, deleteRoute, cards] = await Promise.all([
    readFile("supabase/migrations/20260829204208_implement_client_favorites_repeat_flow.sql", "utf8"),
    readFile("app/api/favorites/route.ts", "utf8"),
    readFile("app/api/favorites/[id]/route.ts", "utf8"),
    readFile("components/client/client-order-cards.tsx", "utf8"),
  ]);
  assert.match(migration, /client_id=v_client_id/);
  assert.match(migration, /v_order\.status in \('cancelled','exception'\)/);
  assert.match(migration, /source_order_item_id/);
  assert.match(migration, /on delete restrict/);
  assert.match(postRoute, /create_client_favorite/);
  assert.match(deleteRoute, /archive_client_favorite/);
  assert.match(cards, /\/api\/favorites/);
  assert.match(cards, /Purchase again/);
});

test("order cards group every SKU under its product ID", async () => {
  const migration = await readFile("supabase/migrations/20260829205353_group_order_cards_by_product_id.sql", "utf8");
  assert.match(migration, /s\.product_link_id::text as order_key/);
});
