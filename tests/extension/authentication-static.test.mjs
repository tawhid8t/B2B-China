import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = "supabase/migrations/20260828094405_extension_credentials_auth.sql";
const queueWrapperRepair = "supabase/migrations/20260828120948_fix_extension_purchase_queue_credential_wrapper.sql";

test("extension credentials are hashed, revocable, profile-bound, and protected by RLS", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create table public\.extension_credentials/);
  assert.match(sql, /token_hash text not null unique/);
  assert.match(sql, /revoked_at timestamptz/);
  assert.match(sql, /last_used_at timestamptz/);
  assert.match(sql, /enable row level security/);
  assert.doesNotMatch(sql, /token text not null/i);
});

test("credential APIs derive the admin profile and return plaintext only at creation", async () => {
  const [createRoute, revokeRoute, utility] = await Promise.all([
    readFile("app/api/admin/extension-credentials/route.ts", "utf8"),
    readFile("app/api/admin/extension-credentials/[id]/route.ts", "utf8"),
    readFile("lib/auth/extension-credentials.ts", "utf8"),
  ]);
  assert.match(createRoute, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.match(createRoute, /profile_id: authorization\.context\.user\.id/);
  assert.match(createRoute, /hashExtensionCredentialToken\(token\)/);
  assert.match(createRoute, /credentialId: data\.id, token/);
  assert.match(revokeRoute, /revoked_at/);
  assert.match(utility, /randomBytes\(32\)/);
  assert.match(utility, /createHash\("sha256"\)/);
});

test("extension routes accept credentials through a centralized guard and retain session compatibility", async () => {
  const [guard, queue, sync] = await Promise.all([
    readFile("lib/auth/extension-api.ts", "utf8"),
    readFile("app/api/extension/purchase-queue/route.ts", "utf8"),
    readFile("app/api/extension/provider-order-sync/route.ts", "utf8"),
  ]);
  assert.match(guard, /authorizeApiRequest\(request, ADMIN_ROLES\)/);
  assert.match(guard, /token_hash/);
  assert.match(guard, /revoked_at/);
  assert.match(guard, /"FORBIDDEN"/);
  assert.match(queue, /authorizeExtensionApiRequest/);
  assert.match(sync, /authorizeExtensionApiRequest/);
  assert.match(sync, /syncProviderOrderAndCommitWalletForExtensionCredential/);
});

test("credential purchase queue wrapper relies on its service-role execute grant, not definer current_user", async () => {
  const sql = await readFile(queueWrapperRepair, "utf8");
  assert.match(sql, /create or replace function public\.get_extension_purchase_queue_for_credential/);
  assert.match(sql, /security definer set search_path = ''/);
  assert.match(sql, /set_config\('request\.jwt\.claim\.sub', p_profile_id::text, true\)/);
  assert.match(sql, /revoke all on function public\.get_extension_purchase_queue_for_credential\(uuid\) from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.get_extension_purchase_queue_for_credential\(uuid\) to service_role/);
  assert.doesNotMatch(sql, /if current_user\s*</);
});

test("CORS is exact-origin, credential-bearing, and limited to extension routes", async () => {
  const [cors, queue, sync] = await Promise.all([
    readFile("lib/api/extension-cors.ts", "utf8"),
    readFile("app/api/extension/purchase-queue/route.ts", "utf8"),
    readFile("app/api/extension/provider-order-sync/route.ts", "utf8"),
  ]);
  assert.match(cors, /CHROME_EXTENSION_ORIGINS/);
  assert.match(cors, /allowed\.includes\(origin\)/);
  assert.doesNotMatch(cors, /Access-Control-Allow-Origin", "\*"/);
  assert.match(queue, /export function OPTIONS/);
  assert.match(sync, /export function OPTIONS/);
});

test("extension stores only its credential locally and centralizes authenticated backend calls", async () => {
  const [api, popup, content] = await Promise.all([
    readFile("extension/api.js", "utf8"), readFile("extension/popup.js", "utf8"), readFile("extension/content.js", "utf8"),
  ]);
  assert.match(api, /chrome\.storage\.local/);
  assert.match(api, /Authorization: `Bearer \$\{credential\}`/);
  assert.match(popup, /extensionApiFetch/);
  assert.doesNotMatch(content, /extensionCredential|Authorization/);
});
