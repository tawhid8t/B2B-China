import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const globals = read("app/globals.css");
const shell = read("components/auth/auth-shell.tsx");
const passwordField = read("components/auth/password-field.tsx");
const signOut = read("components/sign-out-button.tsx");
const continueLoading = read("app/auth/continue/loading.tsx");

test("shared auth shell is Premium-scoped and mobile-first without retheming public pages", () => {
  assert.match(globals, /\.client-theme,\s*\.auth-theme\s*\{/);
  assert.match(shell, /className="auth-theme min-h-\[100dvh\] overflow-x-hidden/);
  assert.match(shell, /safe-area-top/);
  assert.match(shell, /min-h-\[calc\(100dvh-3\.5rem\)\]/);
  assert.match(shell, /max-w-form/);
  assert.match(shell, /hidden[\s\S]*lg:flex/);
  assert.match(shell, /action-primary/);
  assert.doesNotMatch(shell, /(?:commerce|vermilion|gold)-\d+/);
});

test("auth forms preserve inline validation and phone-friendly controls", () => {
  for (const path of ["app/auth/login/page.tsx", "app/auth/register/page.tsx", "app/auth/forgot-password/page.tsx", "app/auth/update-password/page.tsx"]) {
    assert.match(read(path), /<form[\s\S]*noValidate/);
  }
  assert.match(read("components/ui/input.tsx"), /min-h-touch-lg[\s\S]*text-base/);
  assert.match(passwordField, /min-h-touch min-w-touch/);
  assert.match(passwordField, /aria-pressed=\{visible\}/);
});

test("auth continuation and logout expose safe loading and failure feedback", () => {
  assert.match(continueLoading, /AuthShell/);
  assert.match(continueLoading, /LoadingState/);
  assert.match(signOut, /loading=\{signingOut\}/);
  assert.match(signOut, /if \(signingOut\) return/);
  assert.match(signOut, /if \(signOutError\)/);
  assert.match(signOut, /role="alert"/);
  assert.match(signOut, /router\.replace\("\/auth\/login"\)/);
  assert.match(signOut, /router\.refresh\(\)/);
});
