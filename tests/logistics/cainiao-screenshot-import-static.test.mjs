import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Cainiao screenshot evidence is private, bounded, and limited to image types", async () => {
  const [migration, helper] = await Promise.all([
    readFile("supabase/migrations/20260911114343_phase4b_screenshot_import_evidence.sql", "utf8"),
    readFile("lib/logistics/cainiao-screenshot.ts", "utf8"),
  ]);
  assert.match(migration, /'cainiao-imports'/);
  assert.match(migration, /false/);
  assert.match(migration, /8388608/);
  assert.match(migration, /'image\/jpeg', 'image\/png', 'image\/webp'/);
  assert.match(helper, /CAINIAO_SCREENSHOT_MAX_BYTES = 8 \* 1024 \* 1024/);
});

test("screenshot import requires reviewed rows and uses the same profile reconciliation RPC", async () => {
  const route = await readFile("app/api/staff/cainiao-imports/screenshot/route.ts", "utf8");
  assert.match(route, /authorizeApiRequest\(request, RECEIVING_ROLES\)/);
  assert.match(route, /manualCainiaoImportSchema/);
  assert.match(route, /Review every extracted parcel before confirming/);
  assert.match(route, /storage\.from\("cainiao-imports"\)/);
  assert.match(route, /p_source: "screenshot"/);
  assert.match(route, /sync_cainiao_parcels_for_profile/);
});

test("browser OCR is local, reviewable, and confirmation-only", async () => {
  const [ui, parser] = await Promise.all([
    readFile("components/staff/cainiao-screenshot-import.tsx", "utf8"),
    readFile("lib/logistics/cainiao-ocr.ts", "utf8"),
  ]);
  assert.match(ui, /import\("tesseract\.js"\)/);
  assert.match(ui, /OCR runs in this browser/);
  assert.match(ui, /Review before import/);
  assert.match(ui, /Confirm import/);
  assert.match(ui, /\/api\/staff\/cainiao-imports\/screenshot/);
  assert.match(parser, /待取件|已到驿站/);
  assert.match(parser, /pickupCodes/);
});
