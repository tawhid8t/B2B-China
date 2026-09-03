import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const login = await readFile("app/auth/login/page.tsx", "utf8");
const input = await readFile("components/ui/input.tsx", "utf8");
const fonts = await readFile("app/fonts.ts", "utf8");
const globals = await readFile("app/globals.css", "utf8");
const rootLayout = await readFile("app/layout.tsx", "utf8");

test("login keeps the supplied Premium mobile hierarchy without simulated device chrome", () => {
  for (const value of [
    "BridgeCart",
    "Sourcing. Fulfillment. Delivered.",
    "Welcome back",
    "Sign in to manage your sourcing and fulfillment with confidence.",
    'label="Email"',
    'placeholder="you@example.com"',
    'label="Password"',
    'placeholder="Enter your password"',
    "Forgot password?",
    "Need help?",
    "Contact our support team",
    'href="/contact"',
    "Create a client account",
  ]) assert.ok(login.includes(value), `missing ${value}`);

  assert.match(login, /min-h-\[100dvh\]/);
  assert.match(login, /env\(safe-area-inset-bottom\)/);
  assert.match(login, /min-h-\[4\.5rem\]/);
  assert.match(login, /<Mail className="h-5 w-5"/);
  assert.match(login, /<LockKeyhole className="h-5 w-5"/);
  assert.doesNotMatch(login, /status bar|home indicator|iPhone|DeviceFrame/i);
  assert.match(fonts, /Open_Sans/);
  assert.match(rootLayout, /className=\{openSans\.variable\}/);
  assert.match(globals, /font-family: var\(--font-open-sans\)/);
});

test("login adornments preserve shared field semantics and mobile sizing", () => {
  assert.match(input, /startAdornment\?: ReactNode/);
  assert.match(input, /Boolean\(startAdornment\) && "pl-11"/);
  assert.match(input, /aria-describedby=\{describedBy\}/);
  assert.match(input, /min-h-touch-lg/);
  assert.match(input, /text-base/);
  assert.match(login, /<form onSubmit=\{onSubmit\} noValidate/);
});
