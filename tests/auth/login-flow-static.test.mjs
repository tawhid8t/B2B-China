import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("login uses Supabase password authentication and safely handles profile failures", async () => {
  const login = await readFile("app/auth/login/page.tsx", "utf8");
  assert.match(login, /auth\.signInWithPassword/);
  assert.match(login, /from\("profiles"\)/);
  assert.match(login, /profile\.status !== "active"/);
  assert.match(login, /auth\.signOut\(\)/);
  assert.match(login, /Invalid email or password/);
  assert.match(login, /<form[\s\S]*noValidate/);
});

test("server-side session helpers source roles from verified claims and the authenticated profile", async () => {
  const [middleware, session, roles] = await Promise.all([
    readFile("middleware.ts", "utf8"), readFile("lib/auth/session.ts", "utf8"), readFile("lib/auth/roles.ts", "utf8"),
  ]);
  assert.doesNotMatch(middleware, /supabase\.auth\./);
  assert.match(middleware, /Route layouts and API handlers enforce authorization/);
  assert.match(session, /supabase\.auth\.getClaims\(\)/);
  assert.match(session, /from\("profiles"\)/);
  assert.match(session, /profile\.status !== "active"/);
  assert.match(roles, /admin: "\/admin"/);
  assert.match(roles, /super_admin: "\/admin"/);
});

test("logout clears the Supabase browser session", async () => {
  const logout = await readFile("components/sign-out-button.tsx", "utf8");
  assert.match(logout, /auth\.signOut\(\)/);
  assert.match(logout, /router\.replace\("\/auth\/login"\)/);
  assert.match(logout, /if \(signOutError\)/);
  assert.match(logout, /loading=\{signingOut\}/);
});
