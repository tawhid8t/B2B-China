import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const resolvedProduct = {
  productId: "fixture-product",
  provider: "alibaba1688",
  providerItemId: "816432828739",
  originalUrl: "https://detail.1688.com/offer/816432828739.html",
  title: "Professional waterproof travel organizer with reinforced compartments",
  images: ["/placeholder-product.svg?view=front", "/placeholder-product.svg?view=detail"],
  category: "Travel bags and organizers",
  domesticDeliveryCny: 6,
  priceMinCny: 18.8,
  priceMaxCny: 22.5,
  skus: [
    { skuId: "navy-s", providerSkuId: "navy-s", label: "Navy / Small", attributes: { Color: "Navy", Size: "Small" }, priceCny: 18.8, availableQuantity: 42, imageUrl: "/placeholder-product.svg?color=navy" },
    { skuId: "navy-m", providerSkuId: "navy-m", label: "Navy / Medium", attributes: { Color: "Navy", Size: "Medium" }, priceCny: 20.2, availableQuantity: 18, imageUrl: "/placeholder-product.svg?color=navy" },
    { skuId: "ivory-s", providerSkuId: "ivory-s", label: "Ivory / Small", attributes: { Color: "Ivory", Size: "Small" }, priceCny: 18.8, availableQuantity: 31, imageUrl: "/placeholder-product.svg?color=ivory" },
  ],
};

test("Subphase 7H locks the deterministic client ordering journey", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/products/resolve-link", async (route) => {
    // Keep the deterministic response briefly pending so the real loading state is asserted.
    await new Promise((resolve) => setTimeout(resolve, 150));
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: resolvedProduct }) });
  });
  await page.route("**/api/client/order-review-context", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { clientId: "fixture-client", totals: { availableBalanceCny: 50 }, exchangeRate: { cnyToBdt: 19.5, effectiveOn: "2026-09-04" } } }) }));
  await page.route("**/api/orders/confirm", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { clientId: "fixture-client", productOrderId: "product-order-1", orderNumber: "PORD-TEST-0001", submittedAt: "2026-09-04T12:30:00.000Z", status: "pending_admin_review", pendingPayment: false, requiredAmountCny: 18.8, reservedAmountCny: 18.8, uncoveredAmountCny: 0, appliedRate: 19.5, orderItems: [{ orderItemId: "order-item-1", skuId: "navy-s", status: "pending_admin_review" }] } }) }));

  await page.goto("/design-system/client/pages/new-order");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.evaluate(() => document.fonts.ready);

  await page.getByRole("textbox", { name: "Product link" }).fill("https://detail.1688.com/offer/816432828739.html");
  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.locator('[data-ui="product-loading"]')).toBeVisible();
  await expect(page.getByRole("heading", { name: resolvedProduct.title })).toBeVisible();

  const isPhone = ["mobile-430", "small-phone-320"].includes(testInfo.project.name);
  if (isPhone) {
    await page.getByRole("button", { name: /Increase Small quantity/i }).click();
    await page.getByRole("button", { name: "Review estimate", exact: true }).click();
  } else {
    const smallRow = page.locator("tbody tr").filter({ hasText: "Small" });
    await smallRow.getByRole("button", { name: "Select", exact: true }).click();
    await page.getByRole("button", { name: "Review estimate", exact: true }).last().click();
  }

  await expect(page.getByRole("heading", { name: "Review your order estimate" })).toBeVisible();
  await page.getByRole("spinbutton", { name: "Approximate unit weight (g)" }).fill("400");
  await page.getByRole("textbox", { name: "Shipping category" }).fill("Wallet");
  await page.getByRole("button", { name: /Wallet.*Tk 750\/kg/ }).click();
  await expect(page.getByRole("textbox", { name: "Shipping category" })).toHaveValue("Wallet");
  await expect(page.getByText("Estimate breakdown")).toBeVisible();
  await page.getByRole("button", { name: "Confirm order" }).click();

  const result = page.locator('[data-page-section="order-confirmation-result"]');
  await expect(result.getByRole("heading", { name: "Your product order is confirmed" })).toBeVisible();
  await expect(result.getByText("PORD-TEST-0001")).toBeVisible();
  await expect(result.getByRole("link", { name: "Product Statement" })).toHaveAttribute("href", "/client/excel-details");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "order-flow", "captures");
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: path.join(captureDirectory, `${testInfo.project.name}-confirmation.png`), fullPage: true, animations: "disabled" });

  await page.goto("/design-system/client/pages/product-statement");
  await expect(page.getByRole("heading", { name: "Product statement" })).toBeVisible();
  const cards = page.locator('[data-ui="product-statement-cards"]');
  const table = page.locator('[data-ui="product-statement-table"]');
  if (["mobile-430", "small-phone-320", "tablet-768"].includes(testInfo.project.name)) await expect(cards).toBeVisible();
  else await expect(table).toBeVisible();
  await expect(page.getByRole("link", { name: /View submission details/i }).first()).toHaveAttribute("href", /\/client\/excel-details\//);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.goto("/design-system/client/pages/product-statement-detail");
  await expect(page.getByRole("heading", { name: /Professional waterproof travel organizer/ })).toBeVisible();
  await page.getByRole("button", { name: /PORD-TEST-0001/ }).click();
  await expect(page.getByText("Navy / Small")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(captureDirectory, `${testInfo.project.name}-statement-detail.png`), fullPage: true, animations: "disabled" });
});
