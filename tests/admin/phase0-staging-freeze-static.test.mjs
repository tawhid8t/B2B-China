import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const seedPath = "supabase/seeds/admin_workflow_staging.sql";

test("Phase 0 keeps client work frozen with a documented handoff", async () => {
  const handoff = await readFile("docs/client-web/CLIENT_DASHBOARD_ADMIN_FREEZE.md", "utf8");
  assert.match(handoff, /Status: active until the product owner explicitly resumes client-dashboard work/);
  assert.match(handoff, /Do not modify `app\/client\/\*\*`/);
  assert.match(handoff, /Known deferred client work remains unchanged/);
});

test("Phase 0 configures only a fictional, reproducible local staging seed", async () => {
  const [config, guide, seed] = await Promise.all([
    readFile("supabase/config.toml", "utf8"),
    readFile("docs/ADMIN_STAGING_WORKFLOW.md", "utf8"),
    readFile(seedPath, "utf8"),
  ]);
  assert.match(config, /sql_paths = \["\.\/seeds\/admin_workflow_staging\.sql"\]/);
  assert.match(guide, /must never be applied to a linked, preview, or production\s+database/i);
  assert.match(seed, /LOCAL\/DEDICATED-STAGING ONLY/);
  assert.doesNotMatch(seed, /\btruncate\b|\bdelete\s+from\b/i);
  for (const role of ["client", "staff_receiver", "staff_packer", "admin", "super_admin"]) assert.match(seed, new RegExp(`'${role}'`));
  for (const scenario of ["PORD-STAGING-PENDING", "PORD-STAGING-QUEUE", "PORD-STAGING-CART", "PORD-STAGING-FULFILLMENT", "PORD-STAGING-EXCEPTION"]) assert.match(seed, new RegExp(scenario));
  assert.match(seed, /'cart_added'/);
  assert.match(seed, /STAGING PLACEHOLDER — not usable/);
});
