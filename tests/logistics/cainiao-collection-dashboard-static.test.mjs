import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Cainiao collection queue is role-scoped, includes unmatched parcels, and retains canonical parcel links", async () => {
  const migration = await readFile("supabase/migrations/20260911112810_phase4b_collection_queue.sql", "utf8");
  assert.match(migration, /get_cainiao_collection_queue_internal/);
  assert.match(migration, /left join public\.parcel_items/);
  assert.match(migration, /p\.source in \('manual', 'screenshot'\)/);
  assert.match(migration, /v_role not in \('staff_receiver', 'admin', 'super_admin'\)/);
  assert.match(migration, /unmatched_review_status <> 'archived'/);
});

test("collection APIs authorize receiving roles and use the service-only collection wrapper", async () => {
  const [queue, collect] = await Promise.all([
    readFile("app/api/staff/cainiao-parcels/collection/route.ts", "utf8"),
    readFile("app/api/staff/cainiao-parcels/[trackingNumber]/collect/route.ts", "utf8"),
  ]);
  assert.match(queue, /authorizeApiRequest\(request, RECEIVING_ROLES\)/);
  assert.match(queue, /get_cainiao_collection_queue/);
  assert.match(queue, /readyToCollect/);
  assert.match(collect, /authorizeApiRequest\(request, RECEIVING_ROLES\)/);
  assert.match(collect, /collect_cainiao_parcel_for_profile/);
  assert.match(collect, /createSupabaseAdminClient\(\)/);
});

test("staff screen presents collection cards separately from QC", async () => {
  const [page, dashboard] = await Promise.all([
    readFile("app/staff/receiving/page.tsx", "utf8"),
    readFile("components/staff/cainiao-collection-dashboard.tsx", "utf8"),
  ]);
  assert.match(page, /CainiaoCollectionDashboard/);
  assert.match(dashboard, /Today&apos;s collection/);
  assert.match(dashboard, /Mark collected/);
  assert.match(dashboard, /does not complete QC/);
  assert.match(dashboard, /Unmatched Cainiao parcel/);
});

test("operations navigation exposes the receiving workspace to authorized admins", async () => {
  const shell = await readFile("components/app-shell.tsx", "utf8");
  assert.match(shell, /href: "\/staff\/receiving", label: "Receiving"/);
});
