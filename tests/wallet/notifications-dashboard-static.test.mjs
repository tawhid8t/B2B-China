import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const migration = read("supabase/migrations/20260830134546_complete_wallet_notifications_and_dashboard.sql");
const policyFix = read("supabase/migrations/20260830135425_remove_legacy_notification_admin_read_policy.sql");
const service = read("services/notification-service.ts");
const listApi = read("app/api/notifications/route.ts");
const readApi = read("app/api/notifications/[id]/read/route.ts");
const clientPage = read("app/client/notifications/page.tsx");
const adminPage = read("app/admin/notifications/page.tsx");
const dashboard = read("app/admin/page.tsx");
const overview = read("app/admin/overview/page.tsx");

test("notifications are recipient-scoped and only read state is mutable", () => {
  assert.match(migration, /create policy notifications_select_own[\s\S]*profile_id = \(select auth\.uid\(\)\)/);
  assert.match(migration, /revoke update on public\.notifications from authenticated/);
  assert.match(migration, /grant update \(read_at\) on public\.notifications to authenticated/);
  assert.match(policyFix, /drop policy if exists notifications_select_own_or_admin/);
  assert.match(service, /\.eq\("id", notificationId\)[\s\S]*\.is\("read_at", null\)/);
});

test("notification APIs are paginated and limited to financial workspace roles", () => {
  assert.match(listApi, /authorizeApiRequest\(request, \["client", "admin", "super_admin"\]\)/);
  assert.match(listApi, /pageSize: inbox\.pageSize/);
  assert.match(listApi, /unread: inbox\.unread/);
  assert.match(readApi, /markNotificationRead\(authorization\.context/);
});

test("shell notification count is a minimal recipient-scoped server read", () => {
  assert.match(service, /export async function getUnreadNotificationCount/);
  assert.match(service, /getUnreadNotificationCount[\s\S]*\.from\("notifications"\)[\s\S]*\.select\("id", \{ count: "exact", head: true \}\)[\s\S]*\.is\("read_at", null\)/);
  assert.doesNotMatch(service.slice(service.indexOf("export async function getUnreadNotificationCount"), service.indexOf("export async function getNotificationInbox")), /serviceRole|createAdmin/);
});

test("all required wallet and payment events produce durable notifications", () => {
  for (const event of ["payment_proof_submitted", "payment_review_result", "wallet_insufficient", "reservation_released", "wallet_corrected"]) {
    assert.match(migration, new RegExp(event));
  }
  assert.match(migration, /after insert on public\.order_items/);
  assert.match(migration, /after insert on public\.wallet_transactions/);
});

test("client and admin inboxes include failure and empty states", () => {
  assert.match(clientPage, /ErrorState/);
  assert.match(adminPage, /ErrorState/);
  assert.match(read("components/notifications/notification-inbox.tsx"), /EmptyState/);
});

test("admin financial metrics and reconciliation are protected and database backed", () => {
  assert.match(migration, /public\.get_admin_financial_dashboard/);
  assert.match(migration, /public\.get_wallet_reconciliation/);
  assert.match(migration, /public\.current_user_role\(\) not in \('admin', 'super_admin'\)/);
  assert.match(dashboard, /dashboard\.financial\.pendingPaymentProofs/);
  assert.match(dashboard, /dashboard\.financial\.uncoveredOrderCny/);
  assert.doesNotMatch(overview, /mock-data/);
  assert.match(overview, /redirect\("\/admin"\)/);
});
