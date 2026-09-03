import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const routePath = new URL("../../app/api/client/bootstrap/route.ts", import.meta.url);
const contractPath = new URL("../../packages/contracts/src/index.ts", import.meta.url);

test("mobile bootstrap is bearer/session-derived and client-only", async () => {
  const source = await readFile(routePath, "utf8");
  assert.match(source, /authorizeApiRequest\(request, CLIENT_MOBILE_ROLE\)/);
  assert.match(source, /const CLIENT_MOBILE_ROLE = \["client"\]/);
  assert.match(source, /\.eq\("profile_id", user\.id\)/);
  assert.doesNotMatch(source, /searchParams|request\.json\(|clientId/);
});

test("mobile bootstrap exposes only its minimal client identity contract", async () => {
  const route = await readFile(routePath, "utf8");
  const contract = await readFile(contractPath, "utf8");
  assert.match(route, /full_name, email/);
  assert.match(route, /id, business_name/);
  assert.doesNotMatch(route, /risk_flags|assigned_admin_id|user_metadata/);
  assert.match(contract, /role: "client"/);
  assert.match(contract, /status: "active"/);
});
