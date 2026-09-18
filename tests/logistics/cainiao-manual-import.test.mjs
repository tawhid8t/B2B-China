import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = "app/api/staff/cainiao-imports/manual/route.ts";
const contractPath = "lib/logistics/cainiao-import.ts";

test("manual Cainiao import uses receiving authorization and service-only reconciliation", async () => {
  const route = await readFile(routePath, "utf8");
  assert.match(route, /authorizeApiRequest\(request, RECEIVING_ROLES\)/);
  assert.match(route, /createSupabaseAdminClient\(\)/);
  assert.match(route, /sync_cainiao_parcels_for_profile/);
  assert.match(route, /p_source: "manual"/);
  assert.match(route, /removeEmptyImportBatch/);
});

test("manual Cainiao contract normalizes tracking and rejects duplicate records", async () => {
  const contract = await readFile(contractPath, "utf8");
  assert.match(contract, /replace\(\/\\s\+\/g, ""\)\.toUpperCase\(\)/);
  assert.match(contract, /Each tracking number may appear only once in an import/);
  assert.match(contract, /pickupCode: z\.string\(\)\.trim\(\)\.min\(1\)/);
  assert.match(contract, /MANUAL_CAINIAO_STATUSES/);
  assert.match(contract, /source: "manual"/);
});
