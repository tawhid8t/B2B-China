import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("PostgREST-shaped RPC errors map known lifecycle failures instead of becoming generic 500 responses", async () => {
  const source = await readFile("lib/api/database-error.ts", "utf8");
  assert.match(source, /function normalizeDatabaseError/);
  assert.match(source, /typeof value\.message !== "string"/);
  assert.match(source, /const databaseError = normalizeDatabaseError\(error\)/);
  assert.match(source, /databaseError\.code === "23505" \|\| databaseError\.code === "23514"/);
  assert.match(source, /apiError\("CONFLICT", databaseError\.message, 409/);
});
