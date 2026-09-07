import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";

test("New Order fixture is responsive and validates its supported presentation states", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system/client/pages/new-order");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await expect(page.locator('[data-page-section="new-order"]')).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const mobileNavigation = page.getByRole("navigation", { name: "Mobile client navigation" });
  if (testInfo.project.name === "laptop-1024" || testInfo.project.name === "desktop-1440") await expect(mobileNavigation).toBeHidden();
  else await expect(mobileNavigation).toBeVisible();

  const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "new-order", "captures");
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: path.join(captureDirectory, `${testInfo.project.name}.png`), animations: "disabled" });
  const navigationCaptureStyle = await page.addStyleTag({ content: '[data-ui="client-mobile-navigation"] { display: none !important; }' });
  await page.screenshot({ path: path.join(captureDirectory, `${testInfo.project.name}-full.png`), fullPage: true, animations: "disabled" });
  await navigationCaptureStyle.evaluate((style) => style.parentNode?.removeChild(style));

  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.getByText("Paste a supplier product link to continue.")).toBeVisible();

  const productLink = page.getByRole("textbox", { name: "Product link" });
  await productLink.fill("not-a-product-url");
  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.getByText("Use a public product link from 1688, Taobao, or Tmall.")).toBeVisible();

  await productLink.fill("https://example.com/products/123");
  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.getByText("Use a public product link from 1688, Taobao, or Tmall.")).toBeVisible();

  let cancelledRoute: Parameters<Parameters<typeof page.route>[1]>[0] | undefined;
  await page.route("**/api/products/resolve-link", async (route) => { cancelledRoute = route; });
  const preservedUrl = "https://detail.1688.com/offer/123.html";
  await productLink.fill(preservedUrl);
  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.locator('[data-ui="product-loading"]')).toBeVisible();
  await expect(page.getByText("No price or stock information is guessed.")).toBeVisible();
  if (testInfo.project.name === "mobile-430") {
    await page.screenshot({ path: path.join(captureDirectory, "7b-loading-mobile-430.png"), animations: "disabled" });
  }
  await page.getByRole("button", { name: "Cancel lookup" }).click();
  await expect(page.getByText("Product lookup cancelled")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Product link" })).toHaveValue(preservedUrl);
  if (testInfo.project.name === "mobile-430") {
    await page.screenshot({ path: path.join(captureDirectory, "7b-cancelled-mobile-430.png"), animations: "disabled" });
  }
  await cancelledRoute?.abort().catch(() => undefined);
  await page.unroute("**/api/products/resolve-link");

  await page.route("**/api/products/resolve-link", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: { code: "PROVIDER_LOOKUP_FAILED", message: "The supplier is still preparing this product. Please retry shortly.", details: { retryable: true } } }) }));
  await page.getByRole("button", { name: "Retry lookup" }).click();
  await expect(page.getByText("We could not resolve this product")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Product link" })).toHaveValue(preservedUrl);
  if (testInfo.project.name === "mobile-430") {
    await page.screenshot({ path: path.join(captureDirectory, "7b-retryable-error-mobile-430.png"), animations: "disabled" });
  }
  await page.unroute("**/api/products/resolve-link");

  await page.route("**/api/products/resolve-link", async (route) => route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "MANUAL_REVIEW_REQUIRED", message: "The supplier returned genuinely incomplete product data." } }) }));
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("This product needs manual review")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Product link" })).toHaveValue(preservedUrl);
  await page.unroute("**/api/products/resolve-link");

  await page.route("**/api/products/resolve-link", async (route) => route.abort("failed"));
  await page.getByRole("textbox", { name: "Product link" }).fill(`${preservedUrl}?network-test=1`);
  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.getByText("Connection problem")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Product link" })).toHaveValue(`${preservedUrl}?network-test=1`);
  await page.unroute("**/api/products/resolve-link");

  let releaseResolution: (() => void) | undefined;
  await page.route("**/api/products/resolve-link", async (route) => {
    await new Promise<void>((resolve) => { releaseResolution = resolve; });
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { productId: "fixture-product", provider: "alibaba1688", providerItemId: "fixture-item", originalUrl: "https://detail.1688.com/offer/123.html", title: "Fixture supplier product", images: [], category: "Accessories", domesticDeliveryCny: 8, priceMinCny: 22, priceMaxCny: 28, skus: [{ skuId: "fixture-sku", label: "Navy · M", attributes: { Color: "Navy", Size: "M" }, priceCny: 22, availableQuantity: 40 }] } }) });
  });
  await page.getByRole("textbox", { name: "Product link" }).fill(preservedUrl);
  await page.getByRole("button", { name: "Resolve product" }).click();
  await expect(page.locator('[data-ui="product-loading"]')).toBeVisible();
  releaseResolution?.();
  await expect(page.getByRole("heading", { name: "Fixture supplier product" })).toBeVisible();
  if (testInfo.project.name === "mobile-430" || testInfo.project.name === "small-phone-320") {
    await expect(page.getByRole("button", { name: "Navy", exact: true })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: /Increase M quantity/i }).click();
    await expect(page.getByRole("spinbutton", { name: /M quantity/i })).toHaveValue("1");
  }
});

test("Subphase 7C supports responsive multi-SKU color, size, stock, and quantity selection", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design-system/client/pages/new-order?scenario=variants");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole("heading", { name: /Professional waterproof travel organizer/ })).toBeVisible();
  await expect(page.locator('p[lang="zh"]').first()).toHaveText("跨境旅行多功能防水收纳包大容量加厚便携整理袋");
  await expect(page.getByText("Domestic delivery")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  const isPhone = testInfo.project.name === "mobile-430" || testInfo.project.name === "small-phone-320";
  const workspace = page;
  await expect(workspace.getByRole("button", { name: "Navy", exact: true })).toHaveAttribute("aria-pressed", "true");
  await workspace.getByRole("button", { name: "Navy", exact: true }).click();
  if (isPhone) {
    await expect(workspace.getByRole("spinbutton", { name: /Large quantity/i })).toBeDisabled();
    await workspace.getByRole("button", { name: /Increase Small quantity/i }).click();
    await workspace.getByRole("button", { name: /Increase Small quantity/i }).click();
    await expect(workspace.getByRole("spinbutton", { name: /Small quantity/i })).toHaveValue("2");
  } else {
    const smallRow = workspace.locator("tbody tr").filter({ hasText: "Small" });
    await smallRow.getByRole("button", { name: "Select", exact: true }).click();
    await smallRow.getByRole("button", { name: /Increase Navy \/ Small quantity/i }).click();
    await expect(smallRow.getByRole("spinbutton", { name: /Navy \/ Small quantity/i })).toHaveValue("2");
  }

  await workspace.getByRole("button", { name: "Ivory", exact: true }).click();
  if (isPhone) {
    await workspace.getByRole("button", { name: /Increase Medium quantity/i }).click();
    await workspace.getByRole("button", { name: "Navy", exact: true }).click();
    await expect(workspace.getByRole("spinbutton", { name: /Small quantity/i })).toHaveValue("2");
    await workspace.getByRole("button", { name: "Ivory", exact: true }).click();
  } else {
    await workspace.locator("tbody tr").filter({ hasText: "Medium" }).getByRole("button", { name: "Select", exact: true }).click();
  }
  if (isPhone) {
    await expect(workspace.getByText("3 pieces across 2 sizes")).toBeVisible();
    if (testInfo.project.name === "mobile-430") {
      const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "new-order", "captures");
      await mkdir(captureDirectory, { recursive: true });
      await page.screenshot({ path: path.join(captureDirectory, "7c-selection-sheet-mobile-430.png"), animations: "disabled" });
    }
    await workspace.getByRole("button", { name: "Review estimate" }).click();
  } else {
    await expect(page.getByText("Selected supplier items")).toBeVisible();
  }

  const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "new-order", "captures");
  await mkdir(captureDirectory, { recursive: true });
  await page.screenshot({ path: path.join(captureDirectory, `7c-selection-${testInfo.project.name}.png`), fullPage: !isPhone, animations: "disabled" });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Subphase 7C handles single-SKU and large-SKU products", async ({ page }, testInfo) => {
  test.skip(!["mobile-430", "desktop-1440"].includes(testInfo.project.name), "Boundary scenarios run at their relevant viewport.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  if (testInfo.project.name === "mobile-430") {
    await page.goto("/design-system/client/pages/new-order?scenario=single");
    await expect(page.getByText("This product has no color or size choices.")).toBeVisible();
    await page.getByRole("button", { name: "Select" }).click();
    await expect(page.getByRole("spinbutton", { name: /Standard quantity/i })).toHaveValue("1");
  } else {
    await page.goto("/design-system/client/pages/new-order?scenario=large");
    await expect(page.getByRole("button", { name: "Color 1", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("10 returned")).toBeVisible();
    await page.getByRole("button", { name: "Color 12", exact: true }).click();
    await expect(page.getByRole("button", { name: "Color 12", exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Color 12 options")).toBeVisible();
  }
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Subphase 7D reviews a complete estimate with current wallet coverage and preserves edits", async ({ page }, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/client/order-review-context", async (route) => route.fulfill({
    contentType: "application/json",
    body: JSON.stringify({
      data: {
        clientId: "fixture-client",
        totals: { availableBalanceCny: 10 },
        exchangeRate: { cnyToBdt: 19.5, effectiveOn: "2026-09-04" },
      },
    }),
  }));
  await page.goto("/design-system/client/pages/new-order?scenario=variants");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.evaluate(() => document.fonts.ready);

  const isPhone = ["mobile-430", "small-phone-320"].includes(testInfo.project.name);
  if (isPhone) {
    await page.getByRole("button", { name: /Increase Small quantity/i }).click();
  } else {
    const smallRow = page.locator("tbody tr").filter({ hasText: "Small" });
    await smallRow.getByRole("button", { name: "Select", exact: true }).click();
  }

  await page.getByRole("button", { name: "Review estimate", exact: true }).last().click();
  await expect(page.getByRole("heading", { name: "Review your order estimate" })).toBeVisible();
  await expect(page.getByText("Approximate weight required")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm order" })).toBeDisabled();
  await page.getByRole("spinbutton", { name: "Approximate unit weight (g)" }).fill("400");
  await page.getByRole("textbox", { name: "Shipping category" }).fill("Wallet");
  await page.getByRole("button", { name: /Wallet.*Tk 750\/kg/ }).click();
  await expect(page.getByRole("textbox", { name: "Shipping category" })).toHaveValue("Wallet");

  await expect(page.getByText("Estimate breakdown")).toBeVisible();
  await expect(page.getByText("Current exchange rate")).toBeVisible();
  await expect(page.getByText("1 CNY = 19.5000 BDT")).toBeVisible();
  await expect(page.getByText("Predicted wallet coverage")).toBeVisible();
  await expect(page.getByText("Likely uncovered")).toBeVisible();
  await expect(page.getByRole("button", { name: "Confirm order" })).toBeEnabled();

  if (testInfo.project.name === "mobile-430") {
    const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "new-order", "captures");
    await mkdir(captureDirectory, { recursive: true });
    await page.screenshot({ path: path.join(captureDirectory, "7d-estimate-review-mobile-430.png"), fullPage: true, animations: "disabled" });
  }

  await page.getByRole("button", { name: "Edit selections" }).click();
  if (isPhone) await expect(page.getByRole("spinbutton", { name: /Small quantity/i })).toHaveValue("1");
  else await expect(page.locator("tbody tr").filter({ hasText: "Small" }).getByRole("spinbutton")).toHaveValue("1");
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("Subphase 7E submits once and presents authoritative confirmation facts", async ({ page }, testInfo) => {
  test.skip(!["mobile-430", "desktop-1440"].includes(testInfo.project.name), "Success presentation is captured at the primary mobile and desktop widths.");
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.route("**/api/client/order-review-context", async (route) => route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { clientId: "fixture-client", totals: { availableBalanceCny: 10 }, exchangeRate: { cnyToBdt: 19.5, effectiveOn: "2026-09-04" } } }) }));
  let confirmationRequests = 0;
  await page.route("**/api/orders/confirm", async (route) => {
    confirmationRequests += 1;
    if (confirmationRequests === 1) {
      await route.fulfill({ status: 422, contentType: "application/json", body: JSON.stringify({ error: { code: "VALIDATION_ERROR", message: "The selected supplier SKU is no longer available." } }) });
      return;
    }
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ data: { clientId: "fixture-client", productOrderId: "product-order-1", orderNumber: "PORD-TEST-0001", submittedAt: "2026-09-04T12:30:00.000Z", status: "pending_admin_review", pendingPayment: true, requiredAmountCny: 23.13, reservedAmountCny: 10, uncoveredAmountCny: 13.13, appliedRate: 19.5, orderItems: [{ orderItemId: "order-item-1", skuId: "fixture-sku", status: "pending_admin_review" }] } }) });
  });
  await page.goto("/design-system/client/pages/new-order?scenario=variants");
  await page.locator("nextjs-portal").evaluateAll((portals) => portals.forEach((portal) => portal.remove()));
  await page.evaluate(() => document.fonts.ready);

  const isPhone = testInfo.project.name === "mobile-430";
  if (isPhone) await page.getByRole("button", { name: /Increase Small quantity/i }).click();
  else await page.locator("tbody tr").filter({ hasText: "Small" }).getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Review estimate", exact: true }).last().click();
  await page.getByRole("spinbutton", { name: "Approximate unit weight (g)" }).fill("400");
  await page.getByRole("textbox", { name: "Shipping category" }).fill("Wallet");
  await page.getByRole("button", { name: /Wallet.*Tk 750\/kg/ }).click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText("Order not confirmed")).toBeVisible();
  await expect(page.getByText("The selected supplier SKU is no longer available.")).toBeVisible();
  await page.getByRole("button", { name: "Confirm order" }).click();

  await expect(page.getByRole("heading", { name: "Your product order is confirmed" })).toBeVisible();
  await expect(page.getByText("PORD-TEST-0001")).toBeVisible();
  await expect(page.getByText("Additional supplier payment is required")).toBeVisible();
  const result = page.locator('[data-page-section="order-confirmation-result"]');
  await expect(result.getByRole("link", { name: "View orders" })).toHaveAttribute("href", "/client/orders");
  await expect(result.getByRole("link", { name: "Product Statement" })).toHaveAttribute("href", "/client/excel-details");
  expect(confirmationRequests).toBe(2);

  if (isPhone) {
    const captureDirectory = path.join(process.cwd(), "design", "review", "client-phase-7", "new-order", "captures");
    await mkdir(captureDirectory, { recursive: true });
    await page.screenshot({ path: path.join(captureDirectory, "7e-confirmation-result-mobile-430.png"), fullPage: true, animations: "disabled" });
  }
  await page.getByRole("button", { name: "Start another" }).click();
  await expect(page.getByRole("textbox", { name: "Product link" })).toBeVisible();
});
