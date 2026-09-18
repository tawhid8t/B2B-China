import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationPath = "supabase/migrations/20260911110447_phase4b_mobile_import_foundation.sql";

test("mobile Cainiao imports use batches and do not create a second parcel system", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /create table public\.cainiao_import_batches/);
  assert.match(migration, /source in \('manual', 'screenshot'\)/);
  assert.match(migration, /cainiao_import_batch_id uuid references public\.cainiao_import_batches/);
  assert.match(migration, /insert into public\.parcel_items/);
  assert.match(migration, /provider_tracking_captures ptc/);
  assert.match(migration, /unmatched_review_status/);
});

test("mobile import sync is bounded, normalized, and server mediated", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /v_source not in \('manual', 'screenshot'\)/);
  assert.match(migration, /duplicate tracking number in import batch/);
  assert.match(migration, /pickup code is required for a ready parcel/);
  assert.match(migration, /create or replace function public\.sync_cainiao_parcels_for_profile/);
  assert.match(migration, /revoke all on function public\.sync_cainiao_parcels\(jsonb, text\) from public, anon, authenticated/);
  assert.match(migration, /grant execute on function public\.sync_cainiao_parcels_for_profile[\s\S]*to service_role/);
});

test("collection supports the new mobile sources without removing legacy evidence", async () => {
  const migration = await readFile(migrationPath, "utf8");
  assert.match(migration, /v_parcel\.source not in \('manual', 'screenshot', 'cainiao', 'taobao'\)/);
  assert.match(migration, /only a ready Cainiao parcel can be collected/);
  assert.match(migration, /cainiao_parcel_collected/);
});
