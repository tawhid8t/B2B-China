import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  "supabase/migrations/20260827143422_auto_provision_client_profiles.sql",
  "utf8"
);

test("auth provisioning creates a canonical client row for new client users", () => {
  assert.match(migration, /create or replace function private\.handle_new_auth_user\(\)/);
  assert.match(migration, /insert into public\.profiles \(id, role, full_name, email\)/);
  assert.match(migration, /values \(new\.id, 'client', v_full_name, new\.email\)/);
  assert.match(migration, /insert into public\.clients \(/);
  assert.match(migration, /profile_id,\s+business_name,\s+bangladesh_pickup_details,\s+risk_flags/s);
  assert.match(migration, /on conflict \(profile_id\) do nothing/);
});

test("client provisioning ignores user-controlled role metadata", () => {
  assert.doesNotMatch(migration, /raw_user_meta_data\s*->>\s*'role'/);
  assert.match(migration, /Role metadata is intentionally ignored/);
});

test("migration backfills existing client profiles missing business records", () => {
  assert.match(migration, /from public\.profiles p\s+left join public\.clients c on c\.profile_id = p\.id/s);
  assert.match(migration, /where p\.role = 'client'\s+and c\.id is null/s);
});
