import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const orderCards = readFileSync(new URL("../../components/client/client-order-cards.tsx", import.meta.url), "utf8");

test("orders use mobile SKU cards while retaining the desktop order table", () => {
  assert.match(orderCards, /data-page-section="client-orders"/);
  assert.match(orderCards, /function MobileSkuRow/);
  assert.match(orderCards, /mt-5 space-y-3 lg:hidden/);
  assert.match(orderCards, /hidden overflow-x-auto rounded-card border border-border lg:block/);
  assert.match(orderCards, /<table className="min-w-\[820px\] w-full text-left text-sm">/);
  assert.match(orderCards, /<StatusBadge status=\{sku\.status\}/);
  assert.match(orderCards, /sku\.unitPriceCny/);
  assert.match(orderCards, /sku\.quantity/);
  assert.match(orderCards, /sku\.subtotalCny/);
});
