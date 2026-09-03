function sendCartResult(payload) { chrome.runtime.sendMessage({ type: "BRIDGECART_CART_RESULT", payload }); }
function taskSkus(task) { return Array.isArray(task.skus) && task.skus.length ? task.skus : [task]; }
function taskResult(task, state, extra = {}) { return { purchaseTaskId: task.purchaseTaskId || null, orderItemId: task.orderItemId || taskSkus(task)[0]?.orderItemId || null, skuResults: taskSkus(task).map((sku) => ({ orderItemId: sku.orderItemId, prepared: state === "cart-added" })), state, ...extra }; }
function reportStep(task, state, message, extra = {}) { sendCartResult(taskResult(task, state, { message, ...extra })); }

async function prepareCart(task, priceOverride = null) {
  const adapter = globalThis.BridgeCart1688, skus = taskSkus(task);
  if (!adapter) return taskResult(task, "failed", { ok: false, code: "ADAPTER_UNAVAILABLE", message: "1688 cart adapter did not load." });
  adapter.diagnostic("prepare-product-start", { purchaseTaskId: task.purchaseTaskId, skuCount: skus.length, queuedProviderItemId: task.providerItemId });
  reportStep(task, "waiting-for-page", "Waiting for 1688 product controls…");
  const ui = await adapter.waitForProductUI(); if (!ui.ok) return taskResult(task, "needs-review", ui);
  const page = adapter.detectProductPage(); if (!page.ok) return taskResult(task, "failed", page);
  if (!adapter.sameProviderItem(page.providerItemId, task.providerItemId)) return taskResult(task, "needs-review", { ok: false, code: "PRODUCT_MISMATCH", message: "The opened 1688 product does not match this product order." });
  for (const sku of skus) { const translation = adapter.detectTranslation(sku); if (!translation.ok) return taskResult(task, "needs-review", translation); }
  const interaction = adapter.detectInteractionMode();
  if (interaction.mode !== "SKU_MATRIX_MODE" && skus.length > 1) return taskResult(task, "needs-review", { ok: false, code: "MULTI_SKU_LAYOUT_UNSUPPORTED", message: "This 1688 layout cannot safely prepare all requested SKUs in one cart action. Use the documented manual fallback." });
  let prepared, priceLines;
  if (interaction.mode === "SKU_MATRIX_MODE") {
    reportStep(task, "selecting-variants", "Preparing every requested SKU matrix row…");
    const matrix = await adapter.prepareSkuMatrixBatch(skus); if (!matrix.ok) return taskResult(task, "needs-review", matrix);
    prepared = matrix.prepared;
    priceLines = prepared.flatMap(({ request, row }) => request.orderItemIds.map((orderItemId) => ({ orderItemId, expectedPrice: Number(request.expectedUnitPriceCny), currentPrice: row.price })));
  } else {
    const sku = skus[0], matched = adapter.findSku(sku); if (!matched.ok) return taskResult(task, "needs-review", matched);
    const selected = await adapter.selectSku(matched.match); if (!selected.ok) return taskResult(task, "needs-review", selected);
    const quantity = adapter.setQuantity(sku.quantity); if (!quantity.ok) return taskResult(task, "needs-review", quantity);
    const current = adapter.readCurrentUnitPrice(); if (!current.ok) return taskResult(task, "needs-review", current);
    prepared = [{ request: { ...sku, orderItemIds: [sku.orderItemId] }, row: { price: current.price } }]; priceLines = [{ orderItemId: sku.orderItemId, expectedPrice: Number(sku.expectedUnitPriceCny), currentPrice: current.price }];
  }
  const changed = priceLines.filter((line) => Math.abs(line.currentPrice - line.expectedPrice) > 0.009);
  const approved = new Map((priceOverride?.priceLines || []).map((line) => [line.orderItemId, Number(line.currentPrice)]));
  if (changed.some((line) => approved.get(line.orderItemId) !== line.currentPrice)) return taskResult(task, "needs-review", { ok: false, code: priceOverride ? "PRICE_CHANGED_AGAIN" : "PRICE_CHANGED", message: "One or more current 1688 SKU prices differ from the expected prices. Review all affected SKUs before adding to cart.", priceLines: changed });
  reportStep(task, "adding-to-cart", "All SKU rows are prepared and verified. Adding this product once…");
  const cart = await adapter.addToCart({ productVerified: true, colorVerified: true, sizeVerified: true, quantityVerified: true, priceVerified: true });
  return cart.ok ? taskResult(task, "cart-added", { ...cart, ok: true, priceLines }) : taskResult(task, "needs-review", { ...cart, priceLines });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "BRIDGECART_PING") { sendResponse({ ready: true, documentReadyState: document.readyState, url: location.href }); return; }
  if (message?.type === "BRIDGECART_CAPTURE_PROVIDER_ORDER") { const adapter = globalThis.BridgeCart1688, captured = adapter?.captureProviderOrder?.(), matches = captured?.ok ? captured.capture.lines.map((line) => adapter.matchCapturedLine(line, message.payload?.queueItems || [])) : []; sendResponse(captured?.ok ? { ...captured, matches } : (captured || { ok: false, code: "ADAPTER_UNAVAILABLE", message: "1688 order capture adapter did not load." })); return; }
  if (message?.type !== "BRIDGECART_PREPARE_CART" && message?.type !== "BRIDGECART_PRICE_OVERRIDE") return;
  const task = message.type === "BRIDGECART_PRICE_OVERRIDE" ? message.payload.task : message.payload;
  prepareCart(task, message.type === "BRIDGECART_PRICE_OVERRIDE" ? message.payload.priceOverride : null).then((payload) => { sendCartResult(payload); sendResponse(payload); }).catch(() => { const payload = taskResult(task, "failed", { ok: false, code: "PREPARATION_FAILED", message: "Cart preparation could not be completed." }); sendCartResult(payload); sendResponse(payload); });
  return true;
});

chrome.runtime.sendMessage({ type: "BRIDGECART_CONTENT_READY", payload: { providerItemId: globalThis.BridgeCart1688?.getProviderItemId?.() || null, readyState: document.readyState } });
