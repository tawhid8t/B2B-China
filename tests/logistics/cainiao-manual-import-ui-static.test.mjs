import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("staff receiving presents mobile-first Cainiao intake instead of placeholder QC", async () => {
  const [page, intake] = await Promise.all([
    readFile("app/staff/receiving/page.tsx", "utf8"),
    readFile("components/staff/cainiao-manual-import.tsx", "utf8"),
  ]);
  assert.match(page, /Cainiao parcel import/);
  assert.match(page, /CainiaoManualImport/);
  assert.doesNotMatch(page, /Record receipt|QC status/);
  assert.match(intake, /\/api\/staff\/cainiao-imports\/manual/);
  assert.match(intake, /Save & add another/);
  assert.match(intake, /inputMode="numeric"/);
  assert.match(intake, /autoFocus/);
  assert.match(intake, /Collection is separate/);
  assert.match(intake, /matched ·/);
});
