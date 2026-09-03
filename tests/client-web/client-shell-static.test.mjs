import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const shell = read("components/client/client-shell.tsx");
const layout = read("app/client/layout.tsx");
const notifications = read("services/notification-service.ts");

test("client shell keeps one route tree with intentional desktop and mobile navigation", () => {
  assert.match(shell, /const clientRoutes =/);
  assert.match(shell, /const desktopItems = \[clientRoutes\.home, clientRoutes\.newOrder, clientRoutes\.orders, clientRoutes\.wallet, clientRoutes\.notifications, clientRoutes\.statement\]/);
  assert.match(shell, /const mobileItems = \[clientRoutes\.home, clientRoutes\.orders, clientRoutes\.newOrder, clientRoutes\.wallet, clientRoutes\.account\]/);
  assert.match(shell, /hidden w-72[\s\S]*lg:flex/);
  assert.match(shell, /Mobile client navigation[\s\S]*lg:hidden/);
  assert.doesNotMatch(shell, /\/client\/(?:mobile|desktop)\//);
});

test("mobile shell supports the dashboard reference hierarchy without fake device chrome", () => {
  assert.match(shell, /const isDashboard = pathname === "\/client"/);
  assert.match(shell, /active \? "bg-action-active text-on-action"/);
  assert.match(shell, /-mt-8 flex min-w-0 min-h-touch flex-col/);
  assert.match(shell, /newOrder: \{ label: "New order"[\s\S]*icon: Plus/);
  assert.match(shell, /orders: \{ label: "Orders"[\s\S]*icon: ClipboardList/);
  assert.match(shell, /item\.href === clientRoutes\.wallet\.href \? "Wallet"/);
  assert.doesNotMatch(shell, /status bar|home indicator|iPhone|DeviceFrame/i);
});

test("client shell reserves safe-area content space and exposes an accessible app-like mobile shell", () => {
  assert.match(shell, /safe-area-top[\s\S]*min-h-14/);
  assert.match(shell, /pb-\[calc\(5rem\+env\(safe-area-inset-bottom\)\)\]/);
  assert.match(shell, /safe-area-bottom fixed inset-x-0 bottom-0/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shell, /aria-label="Open workspace menu"/);
  assert.match(shell, /<BottomSheet[\s\S]*title="Workspace menu"/);
  assert.match(shell, /Product Statement/);
  assert.match(shell, /href: "\/contact"/);
});

test("mobile menu closes before route navigation and browser Back", () => {
  assert.match(shell, /window\.history\.pushState\([\s\S]*bridgecartClientMenu/);
  assert.match(shell, /window\.addEventListener\("popstate", handlePopState\)/);
  assert.match(shell, /window\.history\.back\(\)/);
  assert.match(shell, /pendingMenuNavigation\.current = href/);
  assert.match(shell, /if \(destination\) router\.push\(destination\)/);
  assert.match(shell, /useEffect\([\s\S]*\[pathname\]\)/);
  assert.match(shell, /window\.matchMedia\("\(min-width: 1024px\)"\)/);
  assert.match(shell, /desktopMedia\.addEventListener\("change", closeForDesktop\)/);
});

test("shell unread badge remains server-derived and optional", () => {
  assert.match(notifications, /export async function getUnreadNotificationCount/);
  assert.match(notifications, /\.from\("notifications"\)[\s\S]*\.select\("id", \{ count: "exact", head: true \}\)[\s\S]*\.is\("read_at", null\)/);
  assert.match(layout, /getUnreadNotificationCount\(context\)\.catch\(\(\) => null\)/);
  assert.match(layout, /unreadNotificationCount=\{unreadNotificationCount\}/);
  assert.match(shell, /unreadCount !== null && unreadCount > 0/);
  assert.match(shell, /unreadCount > 99 \? "99\+" : unreadCount/);
  assert.match(shell, /Open notifications, \$\{unreadCount\} unread/);
});
