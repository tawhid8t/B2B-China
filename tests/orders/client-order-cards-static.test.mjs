import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("client order-card read model is additive, grouped, and ownership protected", async () => {
  const [migration, route, service] = await Promise.all([
    readFile("supabase/migrations/20260829203109_add_client_order_cards_read_model.sql", "utf8"),
    readFile("app/api/client/order-cards/route.ts", "utf8"),
    readFile("services/client-order-cards-service.ts", "utf8"),
  ]);

  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /oi\.client_id = v_client_id/);
  assert.match(migration, /coalesce\(nullif\(s\.provider_order_id, ''\), s\.id::text\)/);
  assert.match(migration, /jsonb_agg\(jsonb_build_object/);
  assert.match(migration, /shippingFeeCny/);
  assert.match(migration, /shippingFeeBdt/);
  assert.match(migration, /totalAmountBdt/);
  assert.match(migration, /favorite/);
  assert.match(migration, /revoke all on function public\.get_client_order_cards/);
  assert.match(route, /CLIENT_OPERATION_ROLES/);
  assert.match(route, /apiSuccess/);
  assert.match(service, /get_client_order_cards/);
  assert.doesNotMatch(service, /createSupabaseAdminClient|SUPABASE_SERVICE_ROLE_KEY/);
});
