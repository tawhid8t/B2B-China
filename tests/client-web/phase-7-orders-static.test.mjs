import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const fixturePage = read("app/design-system/client/pages/orders/page.tsx");
const fixture = read("components/design-system/client-orders-fixture.tsx");
const orderCards = read("components/client/client-order-cards.tsx");
const status = JSON.parse(read("design/review/client-phase-7/status.json"));

test("Phase 7 Orders fixture is development-only and reuses production presentation", () => {
  assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(fixture, /<ClientShell/);
  assert.match(fixture, /<ClientOrderCards/);
  assert.doesNotMatch(fixturePage + fixture, /supabase|fetch\(|@\/services\/.+-service[^\"]/);
});

test("Phase 7 retains approved Orders while Product Statement is under review", () => {
  assert.equal(status.currentPage, "product-statement");
  assert.equal(status.pages.find((page) => page.id === "dashboard")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "orders")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "new-order")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "product-statement")?.status, "awaiting_owner_approval");
  assert.equal(status.pages.filter((page) => page.status === "in_progress").length, 0);
});

test("Orders use authoritative status progress and retain expandable SKU details", () => {
  assert.match(orderCards, /data-ui="order-progress"/);
  assert.match(orderCards, /function stageForOrderStatus/);
  assert.match(orderCards, /const \[expanded, setExpanded\] = useState\(false\)/);
  assert.match(orderCards, /<MobileSkuRow/);
  assert.match(orderCards, /<SkuRow/);
});
