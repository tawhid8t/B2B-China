import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile("app/client/page.tsx", "utf8");
const service = await readFile("services/client-dashboard-service.ts", "utf8");
const dashboard = await readFile("components/client/client-dashboard.tsx", "utf8");
const refresh = await readFile("components/client/dashboard-refresh-button.tsx", "utf8");

test("client dashboard is streaming, protected, and refreshable without a browser data cache", () => {
  assert.match(page, /<Suspense fallback=\{<ClientDashboardSkeleton \/>\}>/);
  assert.match(page, /requireRoleForPath\("\/client"\)/);
  assert.match(page, /getClientDashboardSummary\(context\)/);
  assert.match(page, /ClientDashboardError/);
  assert.match(refresh, /router\.refresh\(\)/);
  assert.doesNotMatch(page + dashboard + service, /mock-data|setInterval|setTimeout\(|fetch\(/);
});

test("dashboard summary remains server-derived, RLS-scoped, and bounded", () => {
  assert.match(service, /assertAuthorizedRole\(context, CLIENT_ROLE\)/);
  assert.match(service, /Promise\.all\(/);
  assert.match(service, /getWalletStatement\(context, \{ pageSize: RECENT_LIMIT \}\)/);
  assert.match(service, /getClientOrderCards\(context\)/);
  assert.match(service, /from\("notifications"\)/);
  assert.match(service, /from\("payment_proofs"\)/);
  assert.match(service, /\.limit\(RECENT_LIMIT\)/);
  assert.match(service, /\.is\("read_at", null\)/);
  assert.match(service, /\.in\("status", \["pending", "needs_review"\]\)/);
  assert.match(service, /uncoveredCny/);
  assert.match(service, /readyForPickup/);
});

test("dashboard uses actual lifecycle presentation and safe client destinations", () => {
  for (const label of ["Available vs reserved", "Active shipments", "Purchase", "China warehouse", "Guangzhou", "Bangladesh", "Pickup", "Recent orders", "Recent wallet activity", "Needs attention"]) {
    assert.ok(dashboard.includes(label), `missing ${label}`);
  }
  assert.match(dashboard, /<StatusBadge status=\{order\.status\}/);
  assert.match(dashboard, /<ProductThumbnail src=\{order\.productImageUrl\}/);
  assert.match(dashboard, /order\.quantity/);
  assert.match(dashboard, /order\.totalAmountCny/);
  assert.match(dashboard, /href="\/client\/wallet"/);
  assert.match(dashboard, /href="\/client\/orders"/);
  assert.match(dashboard, /href="\/client\/notifications"/);
  assert.match(dashboard, /href="\/client\/order\/new"/);
  assert.doesNotMatch(dashboard, /\/client\/orders\/\$\{/);
  assert.doesNotMatch(dashboard, /Paid vs Reserved/);
  assert.match(dashboard, /conic-gradient/);
  assert.match(dashboard, /payment proof.*under review/);
  assert.match(dashboard, /Bookmark.*ArrowLeftRight.*ShieldCheck.*WalletCards/);
  assert.match(dashboard, /ShoppingCart.*Warehouse.*Truck.*Ship.*Package/);
  assert.doesNotMatch(dashboard, /<h3[^>]*>\{order\.productTitle\}/);
  assert.doesNotMatch(dashboard, /<p className="text-xs font-bold uppercase tracking-\[0\.1em\] text-muted">\{order\.displayOrderNumber\}/);
  assert.match(dashboard, /break-all/);
});

test("dashboard keeps its approved mobile hierarchy without changing data contracts", () => {
  assert.match(dashboard, /data-page="client-dashboard"/);
  assert.match(dashboard, /grid grid-cols-\[minmax\(0,1fr\)_minmax\(0,1\.1fr\)\] gap-2 border-t border-border pt-2\.5/);
  assert.match(dashboard, /hidden text-xs leading-5 text-muted sm:block/);
  assert.match(refresh, /size="icon"/);
  assert.match(refresh, /hidden sm:inline-flex/);
  assert.match(refresh, /aria-label="Refresh dashboard"/);
});
