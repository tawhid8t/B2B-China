import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("credential list is admin-only and returns metadata without secrets", async () => {
  const route = await readFile("app/api/admin/extension-credentials/route.ts", "utf8");
  assert.match(route, /export async function GET/); assert.match(route, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.match(route, /select\("id,label,created_at,last_used_at,expires_at,revoked_at"\)/);
  assert.doesNotMatch(route, /select\([^)]*token_hash/);
});
test("extension setup shows raw credential only in the one-time creation modal", async () => {
  const panel = await readFile("components/admin/extension-setup-panel.tsx", "utf8");
  assert.match(panel, /setToken\(body\.data\.token\)/); assert.match(panel, /if \(!open\) setToken\(undefined\)/);
  assert.match(panel, /api\/admin\/extension-credentials/); assert.match(panel, /method: "DELETE"/);
  assert.match(panel, /CHROME_EXTENSION_ORIGINS/);
});
