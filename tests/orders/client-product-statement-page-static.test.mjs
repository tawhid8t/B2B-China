import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("client product details page uses the protected statement API and paged spreadsheet view", async () => {
  const [page, statement, shell, orders] = await Promise.all([
    readFile("app/client/excel-details/page.tsx", "utf8"),
    readFile("components/client/client-product-statement.tsx", "utf8"),
    readFile("components/client/client-shell.tsx", "utf8"),
    readFile("app/client/orders/page.tsx", "utf8"),
  ]);

  assert.match(page, /requireRoleForPath\("\/client\/excel-details"\)/);
  assert.match(statement, /\/api\/client\/product-statement/);
  assert.match(statement, /Product amount|Local delivery|To Guangzhou|BD shipping|Service \(6%\)|Avg\. unit/);
  assert.match(statement, /Total BDT price|totalBdt/);
  assert.match(statement, /startDate|endDate|month|category|status/);
  assert.match(statement, /overflow-x-auto/);
  assert.match(statement, /min-w-\[1550px\]/);
  assert.match(statement, /pageNumbers/);
  assert.match(statement, /Mixed progress/);
  assert.match(shell, /Excel details/);
  assert.match(orders, /Your confirmed orders/);
  assert.doesNotMatch(orders, /ClientProductStatement/);
  assert.doesNotMatch(statement, /order_groups|group_code/);
});

test("Subphase 7F uses the same statement presentation for complete mobile cards and the desktop table", async () => {
  const [statement, fixture, fixturePage] = await Promise.all([
    readFile("components/client/client-product-statement.tsx", "utf8"),
    readFile("components/design-system/client-product-statement-fixture.tsx", "utf8"),
    readFile("app/design-system/client/pages/product-statement/page.tsx", "utf8"),
  ]);
  assert.match(statement, /function StatementCards/);
  assert.match(statement, /data-ui="product-statement-card"/);
  assert.match(statement, /Mixed progress across submissions/);
  assert.match(statement, /\/client\/excel-details\/\$\{row\.product_link_id\}/);
  assert.match(statement, /hidden lg:block/);
  assert.match(statement, /data-ui="product-statement-table"/);
  assert.match(fixture, /<ClientProductStatement fixtureData=/);
  assert.match(fixturePage, /process\.env\.NODE_ENV === "production"\) notFound\(\)/);
  assert.doesNotMatch(fixture, /fetch\(|supabase/);
});
