import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const globals = read("app/globals.css");
const tailwind = read("tailwind.config.ts");
const clientShell = read("components/client/client-shell.tsx");
const authShell = read("components/auth/auth-shell.tsx");
const select = read("components/ui/select.tsx");
const thumbnail = read("components/ui/product-thumbnail.tsx");
const uiIndex = read("components/ui/index.ts");

function sourceFiles(directory) {
  return readdirSync(directory, { recursive: true })
    .map((entry) => `${directory}/${String(entry).replaceAll("\\", "/")}`)
    .filter((path) => statSync(path).isFile() && /\.(?:ts|tsx)$/.test(path));
}

test("Premium Dark Accent Commerce is scoped to the authenticated client shell", () => {
  assert.match(globals, /\.client-theme,\s*\.auth-theme\s*\{/);
  assert.match(globals, /--color-canvas: 238 243 243/);
  assert.match(globals, /--color-action-primary: 11 36 41/);
  assert.match(globals, /--color-accent-mint: 85 214 190/);
  assert.match(globals, /--color-accent-aqua: 69 196 221/);
  assert.match(globals, /--color-accent-violet: 124 108 255/);
  assert.match(globals, /--color-accent-coral: 242 120 104/);
  assert.match(globals, /--radius-card: 1\.25rem/);
  assert.match(clientShell, /className="client-theme min-h-screen/);
  assert.doesNotMatch(authShell, /client-theme/);
  assert.match(authShell, /className="auth-theme min-h-\[100dvh\]/);
});

test("existing root theme defaults remain available to non-client surfaces", () => {
  const root = globals.slice(globals.indexOf(":root"), globals.indexOf(".client-theme"));
  assert.match(root, /--color-canvas: 247 248 245/);
  assert.match(root, /--color-foreground: 25 35 32/);
  assert.match(root, /--color-action-primary: 10 79 51/);
  assert.match(root, /--radius-card: 0\.875rem/);
  assert.match(tailwind, /primary: "rgb\(var\(--color-action-primary\)/);
  assert.match(tailwind, /card: "var\(--radius-card\)"/);
  assert.match(tailwind, /soft: "var\(--shadow-soft\)"/);
});

test("Select exposes the same labelled field accessibility contract", () => {
  assert.match(select, /export type SelectProps/);
  assert.match(select, /htmlFor=\{id\}/);
  assert.match(select, /aria-invalid=\{error \? true/);
  assert.match(select, /aria-describedby=\{describedBy\}/);
  assert.match(select, /id=\{hintId\}/);
  assert.match(select, /id=\{errorId\} role="alert"/);
  assert.match(uiIndex, /Select, type SelectProps/);
});

test("ProductThumbnail reserves a square size and fails to a labelled placeholder", () => {
  assert.match(thumbnail, /export type ProductThumbnailProps/);
  assert.match(thumbnail, /"h-16 w-16"/);
  assert.match(thumbnail, /"h-20 w-20"/);
  assert.match(thumbnail, /"h-24 w-24"/);
  assert.match(thumbnail, /loading="lazy"/);
  assert.match(thumbnail, /decoding="async"/);
  assert.match(thumbnail, /onError=\{\(\) => setFailedSrc/);
  assert.match(thumbnail, /image unavailable/);
  assert.match(uiIndex, /ProductThumbnail, type ProductThumbnailProps/);
});

test("web design primitives stay presentation-only and never import native code", () => {
  const uiSource = sourceFiles("components/ui").map((path) => readFileSync(path, "utf8")).join("\n");
  assert.doesNotMatch(uiSource, /fetch\(|@\/services|@\/lib\/auth|SUPABASE|calculateLogisticsEstimate/);

  const webSource = [...sourceFiles("app"), ...sourceFiles("components"), ...sourceFiles("lib"), ...sourceFiles("services")]
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  assert.doesNotMatch(webSource, /from ["'][^"']*mobile\/|from ["']@bridgecart\/mobile/);
});

test("client presentation uses semantic theme roles instead of legacy brand scales", () => {
  const clientSource = [...sourceFiles("app/client"), ...sourceFiles("components/client"), read("components/notifications/notification-inbox.tsx")]
    .map((pathOrSource) => pathOrSource.endsWith?.(".tsx") ? readFileSync(pathOrSource, "utf8") : pathOrSource)
    .join("\n");
  assert.doesNotMatch(clientSource, /(?:commerce|vermilion|gold)-\d+/);
  assert.match(clientSource, /action-primary/);
  assert.match(clientSource, /accent-mint/);
});
