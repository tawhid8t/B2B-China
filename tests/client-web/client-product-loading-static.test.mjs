import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entry = readFileSync(new URL("../../components/client/product-link-entry.tsx", import.meta.url), "utf8");
const globals = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");

test("product resolution provides an honest, accessible loading experience", () => {
  assert.match(entry, /function ProductResolutionLoading/);
  assert.match(entry, /data-ui="product-loading"/);
  assert.match(entry, /role="status" aria-live="polite"/);
  assert.match(entry, /Checking product details/);
  assert.match(entry, /Reading variants and availability/);
  assert.match(entry, /new AbortController\(\)/);
  assert.match(entry, /if \(loading\) \{/);
  assert.match(entry, /<ProductResolutionLoading/);
  assert.match(entry, /Cancel lookup/);
  assert.doesNotMatch(entry, /\d+%/);
  assert.match(globals, /\.client-theme \.product-loading-scan/);
  assert.match(globals, /@keyframes product-loading-scan/);
});
