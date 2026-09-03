import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const fixturePage = read("app/design-system/client/pages/dashboard/page.tsx");
const fixture = read("components/design-system/client-dashboard-fixture.tsx");
const shell = read("components/client/client-shell.tsx");
const status = JSON.parse(read("design/review/client-phase-7/status.json"));

test("Phase 7 dashboard fixture is development-only and reuses production presentation", () => {
  assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(fixture, /<ClientShell/);
  assert.match(fixture, /<ClientDashboard/);
  assert.doesNotMatch(fixturePage + fixture, /supabase|fetch\(|@\/services\/.+-service[^\"]/);
  assert.match(shell, /visualPathname\?: string/);
  assert.match(shell, /visualPathname \?\? runtimePathname/);
});

test("Phase 7 retains the approved Dashboard and defers unsupported routes", () => {
  assert.equal(status.currentPage, "product-statement");
  assert.equal(status.pages.find((page) => page.id === "dashboard")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "orders")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "new-order")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "product-statement")?.status, "in_progress");
  assert.equal(status.pages.filter((page) => page.status === "in_progress").length, 1);
  assert.ok(status.pages.filter((page) => !["dashboard", "orders", "new-order", "product-statement"].includes(page.id)).every((page) => page.status === "pending"));
  assert.deepEqual(status.primaryMobileViewport, { width: 430, height: 932 });
  assert.ok(status.deferredReferences.includes("favorites-repeat"));
  assert.ok(status.deferredReferences.includes("settings"));
});
