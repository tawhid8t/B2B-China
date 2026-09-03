import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("dashboard fixture is responsive and produces a review capture", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system/client/pages/dashboard");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await expect(page.locator('[data-page="client-dashboard"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile client navigation" });
  if (testInfo.project.name === "laptop-1024" || testInfo.project.name === "desktop-1440") await expect(mobileNavigation).toBeHidden();
  else await expect(mobileNavigation).toBeVisible();
  await expect(page).toHaveScreenshot("dashboard.png", { animations: "disabled" });

  const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "dashboard", "captures");
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: path.join(captureDirectory, `${testInfo.project.name}.png`), animations: "disabled" });
  await page.addStyleTag({ content: '[data-ui="client-mobile-navigation"] { display: none !important; }' });
  await page.screenshot({ path: path.join(captureDirectory, `${testInfo.project.name}-full.png`), fullPage: true, animations: "disabled" });
});
