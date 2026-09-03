import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ADMIN_ROLES,
  CLIENT_OPERATION_ROLES,
  OWNER_ROLES,
  PACKING_ROLES,
  RECEIVING_ROLES,
  isRoleAllowed,
  roleCanAccessPath
} from "../../lib/auth/roles.ts";
import { safePostLoginPath } from "../../lib/auth/safe-redirect.ts";

test("page routes enforce the role boundaries", () => {
  assert.equal(roleCanAccessPath("client", "/client"), true);
  assert.equal(roleCanAccessPath("client", "/admin"), false);
  assert.equal(roleCanAccessPath("staff_receiver", "/staff/receiving"), true);
  assert.equal(roleCanAccessPath("staff_receiver", "/staff/packing"), false);
  assert.equal(roleCanAccessPath("staff_packer", "/staff/packing"), true);
  assert.equal(roleCanAccessPath("staff_packer", "/staff/receiving"), false);
  assert.equal(roleCanAccessPath("admin", "/admin"), true);
  assert.equal(roleCanAccessPath("admin", "/admin/system"), false);
  assert.equal(roleCanAccessPath("super_admin", "/admin/system/users"), true);
});

test("API permission groups allow and deny representative roles", () => {
  assert.equal(isRoleAllowed("client", CLIENT_OPERATION_ROLES), true);
  assert.equal(isRoleAllowed("staff_receiver", CLIENT_OPERATION_ROLES), false);
  assert.equal(isRoleAllowed("staff_receiver", RECEIVING_ROLES), true);
  assert.equal(isRoleAllowed("staff_packer", RECEIVING_ROLES), false);
  assert.equal(isRoleAllowed("staff_packer", PACKING_ROLES), true);
  assert.equal(isRoleAllowed("client", PACKING_ROLES), false);
  assert.equal(isRoleAllowed("admin", ADMIN_ROLES), true);
  assert.equal(isRoleAllowed("admin", OWNER_ROLES), false);
  assert.equal(isRoleAllowed("super_admin", OWNER_ROLES), true);
});

test("post-login redirects remain local and protected", () => {
  assert.equal(safePostLoginPath("/client/orders"), "/client/orders");
  assert.equal(safePostLoginPath("https://attacker.example/client"), undefined);
  assert.equal(safePostLoginPath("//attacker.example"), undefined);
  assert.equal(safePostLoginPath("/auth/login"), undefined);
});

test("login navigation avoids duplicate authenticated checks", async () => {
  const [login, session, middleware] = await Promise.all([
    readFile("app/auth/login/page.tsx", "utf8"),
    readFile("lib/auth/session.ts", "utf8"),
    readFile("middleware.ts", "utf8"),
  ]);

  assert.match(login, /dashboardPathByRole\[profile\.role\]/);
  assert.doesNotMatch(login, /\/auth\/continue/);
  assert.doesNotMatch(login, /router\.refresh\(\)/);
  assert.match(session, /cache\(async \(\) => resolveAuthorizationContext\(\)\)/);
  assert.match(session, /getCachedServerAuthorizationContext\(\)/);
  assert.match(session, /supabase\.auth\.getClaims\(\)/);
  assert.doesNotMatch(session, /supabase\.auth\.getUser\(\)/);
  assert.doesNotMatch(middleware, /supabase\.auth\./);
  assert.match(middleware, /Route layouts and API handlers enforce authorization/);
});
