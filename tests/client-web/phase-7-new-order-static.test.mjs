import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const fixturePage = read("app/design-system/client/pages/new-order/page.tsx");
const fixture = read("components/design-system/client-new-order-fixture.tsx");
const resolver = read("components/client/order-link-resolver.tsx");
const entry = read("components/client/product-link-entry.tsx");
const product = read("components/client/product-detail-buying-interface.tsx");
const status = JSON.parse(read("design/review/client-phase-7/status.json"));

test("Phase 7 New Order fixture is development-only and reuses production presentation", () => {
  assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.match(fixture, /<ClientShell/);
  assert.match(fixture, /<OrderLinkResolver/);
  assert.doesNotMatch(fixturePage + fixture, /supabase|fetch\(|@\/services\/.+-service[^\"]/);
});

test("Phase 7 locks New Order before the Product Statement approval gate", () => {
  assert.equal(status.currentPage, "product-statement");
  assert.equal(status.pages.find((page) => page.id === "orders")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "new-order")?.status, "approved");
  assert.equal(status.pages.find((page) => page.id === "product-statement")?.status, "in_progress");
  assert.equal(status.pages.filter((page) => page.status === "in_progress").length, 1);
  assert.equal(status.orderFlow.currentSubphase, "7G");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7A")?.status, "approved");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7B")?.status, "approved");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7C")?.status, "approved");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7D")?.status, "approved");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7E")?.status, "approved");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7F")?.status, "approved");
  assert.equal(status.orderFlow.subphases.find((subphase) => subphase.id === "7G")?.status, "approved");
  assert.ok(status.orderFlow.subphases.filter((subphase) => !["7A", "7B", "7C", "7D", "7E", "7F", "7G"].includes(subphase.id)).every((subphase) => subphase.status === "pending"));
});

test("Subphase 7B preserves links and distinguishes validation, cancellation, provider, manual-review, and connection states", () => {
  assert.match(entry, /new AbortController\(\)/);
  assert.match(entry, /signal: abortController\.signal/);
  assert.match(entry, /function cancelResolution\(\)/);
  assert.match(entry, /Use a public product link from 1688, Taobao, or Tmall/);
  assert.match(entry, /kind: "cancelled"/);
  assert.match(entry, /code === "MANUAL_REVIEW_REQUIRED"/);
  assert.match(entry, /kind: "connection"/);
  assert.match(entry, /No price or stock information is guessed/);
  assert.doesNotMatch(entry, /\d+%|fabricated percentages/i);
});

test("New Order retains the resolver, direct confirmation, and mobile inline option workflow", () => {
  assert.match(resolver, /<ProductLinkEntry/);
  assert.match(resolver, /<ProductDetailBuyingInterface/);
  assert.match(entry, /data-ui="product-loading"/);
  assert.match(entry, /Supported public links/);
  assert.match(product, /function MobileVariantRow/);
  assert.match(product, /fetch\("\/api\/orders\/confirm"/);
});

test("Subphase 7C uses visual options, disabled combinations, single-SKU controls, and a sticky mobile summary", () => {
  assert.match(product, /variantImageForValue/);
  assert.match(product, /createInitialVariantSelection/);
  assert.match(product, /selectedPiecesForOption/);
  assert.match(product, /ProductThumbnail/);
  assert.match(product, /disabled=\{state !== "available" && !selected\}/);
  assert.match(product, /function UnattributedSkuControls/);
  assert.match(product, /2 SKUs|summary\.selectedSkuCount/);
  assert.match(product, /Review estimate/);
  assert.match(product, /sticky bottom-\[calc\(4\.75rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(product, /Domestic delivery/);
  assert.match(product, /displaySkus/);
});

test("Subphase 7D adds a non-persisted estimate review using server financial context", () => {
  const reviewRoute = read("app/api/client/order-review-context/route.ts");
  const walletService = read("services/client-wallet-service.ts");
  assert.match(product, /function DirectOrderReview/);
  assert.match(product, /Review your order estimate/);
  assert.match(product, /Predicted wallet coverage/);
  assert.match(product, /Pre-confirmation estimate using your current available wallet balance/);
  assert.match(product, /Back to selection/);
  assert.match(product, /This is a current planning estimate\. It is not saved or held until you confirm the order\./);
  assert.doesNotMatch(product, /expires|expiry/i);
  assert.match(reviewRoute, /authorizeApiRequest\(request, \["client"\]\)/);
  assert.match(reviewRoute, /getClientOrderReviewContext/);
  assert.match(walletService, /export async function getClientOrderReviewContext/);
  assert.match(walletService, /resolveOwnClientId\(context\)/);
});

test("Subphase 7E replaces the generic cleared-form alert with an authoritative confirmation result", () => {
  const result = read("components/client/order-confirmation-result.tsx");
  assert.match(resolver, /<OrderConfirmationResult/);
  assert.match(resolver, /onConfirmed=\{setConfirmation\}/);
  assert.match(result, /Your product order is confirmed/);
  assert.match(result, /View orders/);
  assert.match(result, /Product Statement/);
  assert.match(result, /Start another/);
  assert.match(result, /Additional supplier payment is required/);
  assert.match(result, /result\.orderNumber/);
  assert.match(result, /result\.submittedAt/);
  assert.doesNotMatch(resolver, /new order form has been cleared/i);
});
