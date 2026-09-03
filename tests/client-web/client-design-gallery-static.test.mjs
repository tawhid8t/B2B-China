import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const page = read("app/design-system/client/page.tsx");
const gallery = read("components/design-system/client-gallery.tsx");
const globals = read("app/globals.css");
const fonts = read("app/fonts.ts");

test("client component gallery is development-only and does not enter business flows", () => {
  assert.match(page, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(page, /ClientDesignSystemGallery/);
  assert.doesNotMatch(page, /requireRoleForPath|supabase|fetch\(/);
  assert.doesNotMatch(gallery, /requireRoleForPath|supabase|fetch\(|@\/services/);
});

test("gallery covers deterministic foundations, controls, commerce states, navigation, and overlays", () => {
  for (const value of ["Foundations", "Actions and fields", "Status and feedback", "Commerce compositions", "Navigation and content patterns", "Loading, empty, error, and overlays", "BottomSheet", "Modal", "QuantityStepper", "StatusBadge", "ProductThumbnail"]) {
    assert.ok(gallery.includes(value), `missing gallery coverage: ${value}`);
  }
  assert.match(gallery, /const statuses: OrderStatus\[\]/);
  assert.match(gallery, /const swatches =/);
  assert.match(gallery, /useState\(12\)/);
  assert.match(gallery, /No business data, authentication, or API calls are used here\./);
});

test("approved v1 tokens are scoped to the client and Inter is available to client presentation", () => {
  assert.match(globals, /\.client-theme\.design-system-preview/);
  assert.match(globals, /\.client-theme:not\(\.design-system-preview\)/);
  assert.match(globals, /--color-canvas: 248 250 250/);
  assert.match(globals, /--color-action-primary: 0 42 49/);
  assert.match(globals, /font-family: var\(--font-inter\), Inter/);
  assert.match(fonts, /import \{ Inter, Open_Sans \}/);
  assert.match(fonts, /export const inter = Inter/);
  assert.match(page, /className=\{inter\.variable\}/);
  const clientLayout = read("app/client/layout.tsx");
  assert.match(clientLayout, /import \{ inter \} from "@\/app\/fonts"/);
  assert.match(clientLayout, /className=\{inter\.variable\}/);
});

test("gallery buttons use restrained professional hover and press feedback", () => {
  const button = read("components/ui/button.tsx");
  assert.match(button, /data-ui="button"/);
  assert.match(button, /data-variant=\{variant\}/);
  assert.match(globals, /\.client-theme \[data-ui="button"\]/);
  assert.match(globals, /transform: translateY\(-1px\)/);
  assert.match(globals, /scale\(0\.985\)/);
  assert.match(globals, /prefers-reduced-motion/);
  assert.match(gallery, /Continue to estimate/);
  assert.match(gallery, /Action hierarchy/);
});

test("gallery refines native controls, operational statuses, product loading, and mobile navigation", () => {
  const select = read("components/ui/select.tsx");
  const statusBadge = read("components/ui/status-badge.tsx");
  assert.match(select, /data-ui="select"/);
  assert.match(select, /appearance-none/);
  assert.match(statusBadge, /data-ui="status-badge"/);
  assert.match(globals, /\[data-ui="select"\]/);
  assert.match(globals, /\[data-ui="status-badge"\]/);
  assert.match(globals, /product-loading-scan/);
  assert.match(globals, /@keyframes product-loading-scan/);
  assert.match(gallery, /Preparing your product details/);
  assert.match(gallery, /Raised primary action follows the mobile reference/);
  assert.match(gallery, /data-ui="phone-navigation"/);
});

test("shipping category uses a touch-friendly menu and navigation icons remain visible", () => {
  const clientShell = read("components/client/client-shell.tsx");
  assert.match(gallery, /function ShippingCategoryMenu/);
  assert.match(gallery, /aria-haspopup="listbox"/);
  assert.match(gallery, /role="option"/);
  assert.match(gallery, /Sensitive cargo/);
  assert.match(gallery, /Choose handling requirements before you request an estimate/);
  assert.doesNotMatch(gallery, /active === label && !primary && "fill-current"/);
  assert.match(gallery, /\{active\} selected/);
  assert.match(gallery, /aria-pressed=\{active === label\}/);
  assert.match(gallery, /active === label && !primary && "rounded-control bg-action-soft"/);
  assert.doesNotMatch(clientShell, /active && label === "Home" && "fill-current"/);
  assert.match(clientShell, /active && "rounded-control bg-surface\/80"/);
});
