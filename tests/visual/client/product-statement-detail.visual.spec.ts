import { expect, test } from "@playwright/test";

test("Subphase 7G presents aggregate product facts and expandable owned submissions", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system/client/pages/product-statement-detail");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await expect(page.getByRole("heading", { name: /Professional waterproof travel organizer/ })).toBeVisible();
  await expect(page.getByText("Order submissions")).toBeVisible();
  await page.getByRole("button", { name: /PORD-TEST-0001/ }).click();
  await expect(page.getByText("Navy / Small")).toBeVisible();
  await expect(page.getByText("Saved rate")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
