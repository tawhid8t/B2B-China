import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260911094946_phase4a_cainiao_parcel_foundation.sql";

test("Cainiao extends canonical parcels and keeps parcel_items as the multi-item relationship", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /alter table public\.parcels[\s\S]*pickup_code/);
  assert.match(migration, /source_payload jsonb/);
  assert.match(migration, /collected_by uuid/);
  assert.match(migration, /parcel_items` remains the canonical many-to-many/);
  assert.match(migration, /insert into public\.parcel_items/);
  assert.match(migration, /provider_tracking_captures ptc/);
  assert.match(migration, /tracking_number_normalized_key/);
});

test("Cainiao sync is bounded, normalized, idempotent, and preserves collected parcels", async () => {
  const [migration, guard] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("supabase/migrations/20260911095651_require_nonempty_cainiao_sync.sql", "utf8"),
  ]);
  assert.match(migration, /one to two hundred parcels are required/);
  assert.match(migration, /upper\(regexp_replace\(btrim\(coalesce\(v_item->>'trackingNumber'/);
  assert.match(migration, /on conflict \(\(upper\(regexp_replace\(btrim\(tracking_number\)/);
  assert.match(migration, /when public\.parcels\.status in \('received', 'partially_received', 'closed'\)/);
  assert.match(migration, /parcel source evidence is too large/);
  assert.match(migration, /cainiao_parcel_discovered/);
  assert.match(migration, /cainiao_parcel_refreshed/);
  assert.match(guard, /jsonb_array_length\(p_parcels\) < 1/);
});

test("only authenticated roles can sync or collect and receiver direct writes are removed", async () => {
  const [migration, restriction] = await Promise.all([
    readFile(migrationPath, "utf8"),
    readFile("supabase/migrations/20260911095401_restrict_cainiao_collection_rpc.sql", "utf8"),
  ]);
  assert.match(migration, /drop policy if exists parcels_receiver_update/);
  assert.match(migration, /drop policy if exists "receivers manage parcels"/);
  assert.match(migration, /drop policy if exists parcel_items_receiver_update/);
  assert.match(migration, /create or replace function public\.sync_cainiao_parcels_for_credential/);
  assert.match(migration, /grant execute on function public\.sync_cainiao_parcels_for_credential[\s\S]*to service_role/);
  assert.match(migration, /create or replace function public\.collect_cainiao_parcel/);
  assert.match(migration, /v_role not in \('staff_receiver', 'admin', 'super_admin'\)/);
  assert.match(migration, /only a ready Cainiao parcel can be collected/);
  assert.match(migration, /cainiao_parcel_collected/);
  assert.match(restriction, /revoke execute on function public\.collect_cainiao_parcel\(text\) from authenticated/);
  assert.match(restriction, /collect_cainiao_parcel_for_profile/);
  assert.match(restriction, /to service_role/);
});
