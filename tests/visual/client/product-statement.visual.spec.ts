import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("Subphase 7F uses complete mobile product cards and preserves the desktop statement table", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system/client/pages/product-statement");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: "Product statement" })).toBeVisible();
  await expect(page.getByText("Total BDT price")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apply filters" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const cardLayout = ["mobile-430", "small-phone-320", "tablet-768"].includes(testInfo.project.name);
  const cards = page.locator('[data-ui="product-statement-cards"]');
  const table = page.locator('[data-ui="product-statement-table"]');
  if (cardLayout) {
    await expect(cards).toBeVisible();
    await expect(cards.getByText("Mixed progress across submissions")).toBeVisible();
    await expect(cards.getByText("Total quantity").first()).toBeVisible();
    await expect(table).toBeHidden();
  } else {
    await expect(cards).toBeHidden();
    await expect(table).toBeVisible();
    await expect(table.getByText("Product amount")).toBeVisible();
  }

  await page.getByLabel("Category").fill("Travel accessories");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  if (testInfo.project.name === "mobile-430") {
    const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "product-statement", "captures");
    await mkdir(captureDirectory, { recursive: true });
    await page.screenshot({ path: path.join(captureDirectory, "7f-product-statement-mobile-430.png"), fullPage: true, animations: "disabled" });
  }
});
