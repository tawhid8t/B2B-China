import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("unmatched Cainiao linking is admin-only, item-specific, reasoned, and audited", async () => {
  const migration = await readFile("supabase/migrations/20260911122124_phase4b_unmatched_parcel_review.sql", "utf8");
  assert.match(migration, /current_user_role\(\) not in \('admin', 'super_admin'\)/);
  assert.match(migration, /p_order_item_id uuid/);
  assert.match(migration, /p_reason text/);
  assert.match(migration, /parcel_items/);
  assert.match(migration, /cainiao_parcel_manually_linked/);
  assert.match(migration, /does not claim parcel-specific quantity/);
});

test("admin review UI uses protected candidate and linking APIs", async () => {
  const [ui, route] = await Promise.all([
    readFile("components/staff/cainiao-unmatched-review.tsx", "utf8"),
    readFile("app/api/admin/cainiao-parcels/[trackingNumber]/link/route.ts", "utf8"),
  ]);
  assert.match(ui, /Admin review/);
  assert.match(ui, /Provider-backed order item/);
  assert.match(ui, /Verification reason/);
  assert.match(ui, /api\/admin\/cainiao-parcels/);
  assert.match(route, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.match(route, /link_cainiao_unmatched_parcel/);
});
