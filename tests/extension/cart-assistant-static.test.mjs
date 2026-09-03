import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

async function loadAdapter(url, documentOverrides = {}) {
  const source = await readFile("extension/adapters/1688/adapter.js", "utf8");
  const FakeInput = function () {};
  Object.defineProperty(FakeInput.prototype, "value", { get() { return this._value; }, set(value) { this._value = String(value); } });
  const context = { URL, Event: class { constructor(type, init) { this.type = type; Object.assign(this, init); } }, HTMLInputElement: FakeInput, console: { info() {} }, setTimeout, clearTimeout, setInterval, clearInterval, window: { location: { href: url }, getComputedStyle: () => ({ display: "block", visibility: "visible" }) }, document: { readyState: "complete", documentElement: {}, querySelectorAll: () => [], ...documentOverrides } };
  context.globalThis = context;
  vm.runInNewContext(source, context);
  return context.BridgeCart1688;
}

async function loadWorker(chrome) {
  const source = await readFile("extension/background.js", "utf8");
  let now = 0;
  const FakeDate = class extends Date { static now() { now += 100; return now; } };
  const context = { URL, Date: FakeDate, console: { info() {} }, setTimeout: (callback) => { callback(); return 1; }, clearTimeout() {}, chrome };
  context.globalThis = context;
  vm.runInNewContext(`${source}\nglobalThis.workerTest = { waitForExpectedContent, waitForOrderContent, captureProviderOrder, offerIdFromUrl, isExpectedProductUrl, isSupportedOrderPageUrl };`, context);
  return context.workerTest;
}

test("adapter extracts real offer URLs, normalizes abb IDs, and safely parses price", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894447674850.html?foo=bar");
  assert.equal(adapter.getProviderItemId(), "894447674850");
  assert.equal(adapter.sameProviderItem("abb-894447674850", "894447674850"), true);
  assert.equal(adapter.parsePrice("\u00a5 42.50"), 42.5);
  assert.equal(adapter.parsePrice("\u00a5 42.50-49.50"), null);
  assert.equal(adapter.normalizeVariantText("22\u7801  \u5185\u957f14.5CM"), adapter.normalizeVariantText("22\u7801 \u5185\u957f14.5cm"));
  assert.notEqual(adapter.normalizeVariantText("22\u7801 \u5185\u957f14.5CM"), adapter.normalizeVariantText("21\u7801 \u5185\u957f14.5CM"));
});

test("post-purchase capture keeps missing monetary values null and matches only an exact queued SKU", async () => {
  const element = { dataset: { offerId: "894128442158", skuId: "pink-22", quantity: "3", unitPrice: "31", subtotal: "93", freight: "8", paidAmount: "101", attributes: '{"颜色":"粉色","尺码":"22码"}' }, textContent: "", getAttribute: () => null, getClientRects: () => [1], querySelectorAll: () => [] };
  const root = { dataset: { orderId: "168812345678" }, textContent: "", getAttribute: () => null, getClientRects: () => [1] };
  const fixture = { querySelectorAll: (selector) => selector === "[data-order-id]" ? [root] : selector === "[data-order-line]" || selector === "[data-offer-id]" ? [element] : [] };
  const adapter = await loadAdapter("https://trade.1688.com/order/detail.htm?orderId=168812345678", fixture);
  const capture = adapter.captureProviderOrder();
  assert.equal(capture.ok, true);
  assert.equal(capture.capture.lines[0].actualDiscountCny, null);
  assert.equal(capture.capture.lines[0].domesticFreightCny, 8);
  const match = adapter.matchCapturedLine(capture.capture.lines[0], [{ orderItemId: "item-1", providerItemId: "894128442158", providerSkuId: "pink-22", attributes: { "颜色": "粉色", "尺码": "22码" }, quantity: 3 }]);
  assert.equal(match.state, "MATCHED");
  assert.equal(adapter.matchCapturedLine(capture.capture.lines[0], [{ orderItemId: "item-2", providerItemId: "894128442158", providerSkuId: "other" }]).state, "SKU_MISMATCH");
  assert.equal(adapter.matchCapturedLine({ ...capture.capture.lines[0], providerSkuId: null }, [{ orderItemId: "item-2", providerItemId: "894128442158", attributes: { "颜色": "粉色", "尺码": "22码" } }, { orderItemId: "item-3", providerItemId: "894128442158", attributes: { "颜色": "粉色", "尺码": "22码" } }]).state, "AMBIGUOUS_MATCH");
});

test("attribute mapping uses exact labels, aliases, then an unambiguous exact value", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const attribute = (key, value) => ({ key, value, normalizedKey: adapter.normalizeVariantText(key), normalizedValue: adapter.normalizeVariantText(value) });
  const group = (label, values, index) => ({ label, normalizedLabel: adapter.normalizeVariantText(label), index, options: values.map((text) => ({ text, normalizedText: adapter.normalizeVariantText(text) })) });
  const color = group("\u989c\u8272", ["\u7c89\u8272", "\u9ed1\u8272"], 0);
  const size = group("", ["22\u7801 \u5185\u957f14.5CM", "23\u7801 \u5185\u957f15CM"], 1);
  assert.equal(adapter.mapAttributeToGroup(attribute("\u989c\u8272", "\u7c89\u8272"), [color, size]).method, "exact-label");
  assert.equal(adapter.mapAttributeToGroup(attribute("\u5c3a\u7801", "22\u7801 \u5185\u957f14.5cm"), [color, size]).method, "unique-value");
  const aliasSize = group("\u5c3a\u7801\u9009\u62e9", size.options.map((option) => option.text), 1);
  assert.equal(adapter.mapAttributeToGroup(attribute("\u5c3a\u7801", "22\u7801 \u5185\u957f14.5CM"), [color, aliasSize]).method, "label-alias");
});

test("confirmed item-label fixture uses title text and remains eligible for local grouping", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const liveFixture = { dataset: {}, textContent: "22\u7801 \u5185\u957f14.5CM", getAttribute: (name) => name === "title" ? "22\u7801 \u5185\u957f14.5CM" : null };
  assert.equal(adapter.optionTextFor(liveFixture), "22\u7801 \u5185\u957f14.5CM");
  assert.equal(adapter.normalizeVariantText(adapter.optionTextFor(liveFixture)), adapter.normalizeVariantText("22\u7801 \u5185\u957f14.5cm"));
  const source = await readFile("extension/adapters/1688/adapter.js", "utf8");
  assert.match(source, /span\.item-label/);
  assert.match(source, /actionElementFor/);
  assert.match(source, /itemLabelGroupRoot/);
  assert.match(source, /item-label-discovery/);
});

test("confirmed expand-view SKU matrix uses exact row labels, row-scoped quantity, and row price", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const source = await readFile("extension/adapters/1688/adapter.js", "utf8");
  assert.equal(adapter.parseStock("库存193双"), 193);
  assert.equal(adapter.parseStock("暂无库存"), null);
  assert.match(source, /matrixRows: \["\.expand-view-list \.expand-view-item"/);
  assert.match(source, /function detectInteractionMode/);
  assert.match(source, /SKU_MATRIX_MODE/);
  assert.match(source, /function discoverSkuMatrix/);
  assert.match(source, /function parseMatrixRowPrice/);
  assert.match(source, /function prepareSkuMatrix/);
  assert.match(source, /rowElement\.querySelectorAll\(selector\)/);
  assert.match(source, /input\.ant-input-number-input/);
  assert.match(source, /function rowQuantityControl/);
  assert.match(source, /ROW_QUANTITY_CONTROL_NOT_FOUND/);
  assert.match(source, /SKU_ROW_AMBIGUOUS/);
  assert.match(source, /sku-row-match/);
  assert.match(source, /set-row-quantity/);
});

test("SKU matrix fixture resolves local color groups and prepares only the exact color and size row", async () => {
  const node = ({ title = null, textContent = "", value = "0" } = {}) => ({
    dataset: {}, disabled: false, readOnly: false, _value: value, get value() { return this._value; }, set value(next) { this._value = String(next); }, textContent, innerText: textContent,
    classList: { contains: () => false }, closest: () => null, getClientRects: () => [1],
    getAttribute: (name) => name === "title" ? title : null, dispatchEvent() {}, querySelector: () => null, querySelectorAll: () => [],
  });
  const makeRow = (label, price, stock) => {
    const input = node({ value: "0" });
    const itemLabel = node({ title: label, textContent: label });
    const priceNode = node({ textContent: `¥${price}` });
    return {
      label, input, classList: { contains: () => false }, closest: () => null, disabled: false, getClientRects: () => [1],
      innerText: `${label} ¥${price} 库存${stock}双`, textContent: `${label} ¥${price} 库存${stock}双`,
      querySelector: (selector) => selector === "span.item-label" ? itemLabel : selector.includes("[data-price]") ? priceNode : null,
      querySelectorAll: (selector) => selector.includes("input") ? [input] : [],
    };
  };
  const row21 = makeRow("21码 内长14CM", 31, 193);
  const pinkRow22 = makeRow("22码 内长14.5CM", 31, 193);
  const blackRow22 = makeRow("22码 内长14.5CM", 32, 193);
  const makeGroup = (color, rows) => ({
    dataset: { color }, className: "color-card", parentElement: null, contains: () => false, getClientRects: () => [1],
    getAttributeNames: () => ["data-color"], getAttribute: (name) => name === "data-color" ? color : null,
    querySelectorAll: (selector) => selector.includes("expand-view") ? rows : [],
  });
  const pinkGroup = makeGroup("粉色", [row21, pinkRow22]);
  const blackGroup = makeGroup("黑色", [blackRow22]);
  const matrixDocument = { querySelectorAll: (selector) => selector === ".expand-view-list-wrapper" ? [pinkGroup, blackGroup] : [] };
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html", matrixDocument);
  assert.equal(adapter.detectInteractionMode().mode, "SKU_MATRIX_MODE");
  const groups = adapter.discoverMatrixGroups();
  assert.equal(JSON.stringify(groups.map((group) => [group.values, group.rows.length])), JSON.stringify([[["粉色"], 2], [["黑色"], 1]]));
  const prepared = await adapter.prepareSkuMatrix({ attributes: { "颜色": "粉色", "尺码": "22码 内长14.5CM" }, quantity: 3 });
  assert.equal(prepared.ok, true);
  assert.equal(row21.input.value, "0");
  assert.equal(pinkRow22.input.value, "3");
  assert.equal(blackRow22.input.value, "0");
  assert.equal(adapter.verifySkuMatrixRow(prepared.row, 3, prepared.otherRowQuantities).ok, true);
  const wrongSize = await adapter.prepareSkuMatrix({ attributes: { "颜色": "粉色", "尺码": "23码 内长15CM" }, quantity: 3 });
  assert.equal(wrongSize.code, "SKU_ROW_NOT_FOUND");
  const wrongColor = await adapter.prepareSkuMatrix({ attributes: { "颜色": "蓝色", "尺码": "22码 内长14.5CM" }, quantity: 3 });
  assert.equal(wrongColor.code, "COLOR_CONTROL_NOT_FOUND");
});

test("confirmed feature-item color controls activate before using the separate size matrix", async () => {
  let activeColor = "卡其色";
  const base = (extra = {}) => ({ dataset: {}, disabled: false, readOnly: false, className: "", parentElement: null, childNodes: [], classList: { contains: () => false }, closest: () => null, getAttributeNames: () => [], getAttribute: () => null, getClientRects: () => [1], querySelector: () => null, querySelectorAll: () => [], dispatchEvent() {}, ...extra });
  const makeRow = (label) => {
    const input = base({ _value: "", className: "ant-input-number-input" });
    Object.defineProperty(input, "value", { get() { return this._value; }, set(value) { this._value = String(value); } });
    const itemLabel = base({ textContent: label, innerText: label, getAttribute: (name) => name === "title" ? label : null });
    const price = base({ textContent: "¥31" });
    return base({ innerText: `${label} ¥31 库存193双`, textContent: `${label} ¥31 库存193双`, querySelector: (selector) => selector === "span.item-label" ? itemLabel : selector.includes("[data-price]") ? price : null, querySelectorAll: (selector) => selector === "input.ant-input-number-input" ? [input] : [] });
  };
  const row22 = makeRow("22码 内长14.5CM");
  const matrix = base({ contains: () => false, querySelectorAll: (selector) => selector.includes("expand-view") ? [row22] : [] });
  const heading = (text) => base({ textContent: text, innerText: text });
  const colorButton = (value) => {
    const label = base({ textContent: value, innerText: value });
    return base({ tagName: "BUTTON", textContent: value, innerText: value, className: "sku-filter-button", classList: { contains: (name) => name === "active" && activeColor === value }, querySelectorAll: (selector) => selector.includes("label-name") ? [label] : [], click: () => { activeColor = value; } });
  };
  const buttons = ["粉色", "卡其色", "黑色", "蓝色"].map(colorButton);
  const colorFeature = base({ querySelectorAll: (selector) => selector.includes("feature-item-label h3") ? [heading("颜色")] : selector.includes("sku-filter-button") ? buttons : [] });
  const sizeFeature = base({ querySelectorAll: (selector) => selector.includes("feature-item-label h3") ? [heading("尺码")] : selector.includes("expand-view") ? [matrix] : [] });
  const documentFixture = { querySelectorAll: (selector) => selector === ".feature-item" ? [colorFeature, sizeFeature] : selector === ".expand-view-list-wrapper" ? [matrix] : [] };
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html", documentFixture);
  const discovered = adapter.discoverFeatureColorControls();
  assert.equal(JSON.stringify(discovered.controls.map((control) => control.value)), JSON.stringify(["粉色", "卡其色", "黑色", "蓝色"]));
  assert.equal(discovered.controls.find((control) => control.value === "卡其色").selected, true);
  const prepared = await adapter.prepareSkuMatrix({ attributes: { "颜色": "粉色", "尺码": "22码 内长14.5CM" }, quantity: 3 });
  assert.equal(activeColor, "粉色");
  assert.equal(prepared.ok, true, JSON.stringify(prepared));
  assert.equal(row22.querySelectorAll("input.ant-input-number-input")[0].value, "3");
  assert.equal(adapter.sizeMatrixGroup().ok, true);
  assert.equal(adapter.matchFeatureColorControl(discovered.controls, "蓝色").ok, true);
  assert.equal(adapter.matchFeatureColorControl(discovered.controls, "灰色").code, "COLOR_CONTROL_NOT_FOUND");
  assert.equal(adapter.matchFeatureColorControl([discovered.controls[0], discovered.controls[0]], "粉色").code, "COLOR_CONTROL_AMBIGUOUS");
});

test("Ant Design matrix quantity uses only row-local stepper controls and fresh rows", async () => {
  let directAssignments = 0, plusClicks = 0, minusClicks = 0;
  const input = { dataset: {}, disabled: false, readOnly: false, className: "ant-input-number-input", _value: "", get value() { return this._value; }, set value(next) { directAssignments += 1; this._value = String(next); }, getClientRects: () => [1], getAttribute: () => null, closest: (selector) => selector.includes("ant-input-number-wrapper") ? wrapper : null };
  const button = (label, change) => ({ dataset: {}, className: label === "plus" ? "ant-input-number-handler-up" : "ant-input-number-handler-down", getClientRects: () => [1], getAttribute: (name) => name === "aria-label" ? label : null, textContent: "", closest: () => null, click: () => { if (label === "plus") plusClicks += 1; else minusClicks += 1; input._value = String(Math.max(0, Number(input._value || 0) + change)); } });
  const plus = button("plus", 1), minus = button("minus", -1);
  const wrapper = { querySelectorAll: () => [plus, minus] };
  const itemLabel = { dataset: {}, textContent: "22码 内长14.5CM", getAttribute: (name) => name === "title" ? "22码 内长14.5CM" : null };
  const price = { textContent: "¥31", getAttribute: () => null };
  const rowElement = { dataset: {}, classList: { contains: () => false }, closest: () => null, disabled: false, innerText: "22码 内长14.5CM ¥31 库存193双", textContent: "22码 内长14.5CM ¥31 库存193双", getClientRects: () => [1], querySelector: (selector) => selector === "span.item-label" ? itemLabel : selector.includes("[data-price]") ? price : null, querySelectorAll: (selector) => selector === "input.ant-input-number-input" ? [input] : [] };
  const groupElement = { querySelectorAll: (selector) => selector.includes("expand-view") ? [rowElement] : [] };
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const initial = { ...adapter.matrixRowCandidate(rowElement), groupElement };
  const group = { element: groupElement, rows: [initial] };
  const up = await adapter.setMatrixRowQuantity(group, initial, 3);
  assert.equal(up.ok, true);
  assert.equal(plusClicks, 3);
  assert.equal(minusClicks, 0);
  assert.equal(input.value, "3");
  assert.equal(directAssignments, 0);
  const down = await adapter.setMatrixRowQuantity(group, up.row, 1);
  assert.equal(down.ok, true);
  assert.equal(minusClicks, 2);
  const stuckPlus = { ...plus, click: () => { plusClicks += 1; } };
  wrapper.querySelectorAll = () => [stuckPlus, minus];
  input._value = "0";
  const stuckRow = { ...adapter.matrixRowCandidate(rowElement), groupElement };
  const stuck = await adapter.setMatrixRowQuantity(group, stuckRow, 1);
  assert.equal(stuck.code, "QUANTITY_INTERACTION_FAILED");
});

test("duplicate exact matrix color groups fail safely without classic mapping", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const pink = adapter.normalizeVariantText("粉色");
  const attribute = { value: "粉色", normalizedValue: pink };
  const duplicate = [{ values: ["粉色"], normalizedValues: [pink] }, { values: ["粉色"], normalizedValues: [pink] }];
  assert.equal(adapter.matchMatrixGroup(duplicate, attribute).code, "MATRIX_GROUP_AMBIGUOUS");
  const source = await readFile("extension/adapters/1688/adapter.js", "utf8");
  const matrixFunction = source.slice(source.indexOf("async function prepareSkuMatrix"), source.indexOf("function verifySkuMatrixRow"));
  assert.match(source, /function discoverMatrixGroups/);
  assert.match(source, /matrix-group-match/);
  assert.match(source, /MATRIX_GROUP_NOT_FOUND/);
  assert.match(source, /MATRIX_GROUP_AMBIGUOUS/);
  assert.doesNotMatch(matrixFunction, /findSku\(/);
});

test("matrix color controls require an exact value and activation-based matrix proof", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const pink = adapter.normalizeVariantText("粉色");
  const controls = [{ values: ["粉色"], selected: false }, { values: ["黑色"], selected: false }];
  assert.equal(adapter.matchMatrixColorControl(controls, { value: "粉色", normalizedValue: pink }).ok, true);
  assert.equal(adapter.matchMatrixColorControl(controls, { value: "蓝色", normalizedValue: adapter.normalizeVariantText("蓝色") }).code, "COLOR_CONTROL_NOT_FOUND");
  const source = await readFile("extension/adapters/1688/adapter.js", "utf8");
  assert.match(source, /img\[alt\]/);
  assert.match(source, /function discoverMatrixColorControls/);
  assert.match(source, /function activateMatrixColor/);
  assert.match(source, /MATRIX_ACTIVATION_FAILED/);
  assert.match(source, /matrix-color-activate/);
  assert.match(source, /matrix-group-context/);
});

test("matrix preparation batches every product SKU before one cart action", async () => {
  const content = await readFile("extension/content.js", "utf8");
  assert.ok(content.indexOf('interaction.mode === "SKU_MATRIX_MODE"') < content.indexOf("adapter.findSku(sku)"));
  assert.match(content, /adapter\.prepareSkuMatrixBatch\(skus\)/);
  assert.match(content, /MULTI_SKU_LAYOUT_UNSUPPORTED/);
  assert.ok(content.indexOf("prepareSkuMatrixBatch(skus)") < content.indexOf("adapter.addToCart({"));
});

test("safe cart action selects only the confirmed ADD_CART button inside submitOrder", async () => {
  const makeButton = (text, action, datatype = action) => {
    let clicks = 0;
    return { tagName: "BUTTON", textContent: text, dataset: {}, disabled: false, className: "v-button", classList: { contains: () => false }, closest: () => null, getClientRects: () => [1], getAttribute: (name) => name === "data-click" ? action : name === "datatype" ? datatype : null, click: () => { clicks += 1; }, get clicks() { return clicks; } };
  };
  const order = makeButton("立即下单", "ORDER"), cart = makeButton("加采购车", "ADD_CART"), publish = makeButton("跨境铺货", "CROSS_BORDER_PUBLISH");
  const root = { getClientRects: () => [1], querySelectorAll: (selector) => selector.includes("ADD_CART") ? [cart] : [] };
  const toast = { textContent: "Added successfully", dataset: {}, getAttribute: () => null, getClientRects: () => [1] };
  const documentFixture = { querySelectorAll: (selector) => ["#submitOrder", ".module-od-submit-order"].includes(selector) ? [root] : selector.includes("toast") || selector.includes("message") || selector.includes("success") ? [toast] : [] };
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html", documentFixture);
  assert.equal(adapter.safeCartButton(), cart);
  const result = await adapter.addToCart({ productVerified: true, colorVerified: true, sizeVerified: true, quantityVerified: true, priceVerified: true }, { attempts: 1, intervalMs: 0 });
  assert.equal(result.code, "CART_ADDED");
  assert.equal(result.confirmationMethod, "success-toast");
  assert.equal(cart.clicks, 1);
  assert.equal(order.clicks, 0);
  assert.equal(publish.clicks, 0);
  const incomplete = await adapter.addToCart({ productVerified: true });
  assert.equal(incomplete.code, "ADD_TO_CART_UNCONFIRMED");
  assert.equal(cart.clicks, 1);
});

test("cart confirmation accepts a cart count increase, including a delayed update", async () => {
  let cartCount = 2;
  let clicks = 0;
  const cart = { tagName: "BUTTON", textContent: "\u52a0\u91c7\u8d2d\u8f66", dataset: {}, disabled: false, className: "v-button", classList: { contains: () => false }, closest: () => null, getClientRects: () => [1], getAttribute: (name) => name === "data-click" || name === "datatype" ? "ADD_CART" : null, click: () => { clicks += 1; setTimeout(() => { cartCount = 3; }, 20); } };
  const root = { getClientRects: () => [1], querySelectorAll: (selector) => selector.includes("ADD_CART") ? [cart] : [] };
  const badge = { dataset: { cartCount: "" }, textContent: "", getClientRects: () => [1], getAttribute: (name) => name === "data-cart-count" ? String(cartCount) : null };
  const documentFixture = { querySelectorAll: (selector) => ["#submitOrder", ".module-od-submit-order"].includes(selector) ? [root] : selector === "[data-cart-count]" ? [badge] : [] };
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html", documentFixture);
  const outcome = await adapter.addToCart({ productVerified: true, colorVerified: true, sizeVerified: true, quantityVerified: true, priceVerified: true }, { attempts: 3, intervalMs: 25 });
  assert.equal(outcome.code, "CART_ADDED");
  assert.equal(outcome.confirmationMethod, "cart-count");
  assert.equal(clicks, 1);
});

test("cart confirmation remains unconfirmed for no proof or an unrelated toast", async () => {
  let clicks = 0;
  const cart = { tagName: "BUTTON", textContent: "\u52a0\u91c7\u8d2d\u8f66", dataset: {}, disabled: false, className: "v-button", classList: { contains: () => false }, closest: () => null, getClientRects: () => [1], getAttribute: (name) => name === "data-click" || name === "datatype" ? "ADD_CART" : null, click: () => { clicks += 1; } };
  const root = { getClientRects: () => [1], querySelectorAll: (selector) => selector.includes("ADD_CART") ? [cart] : [] };
  const unrelatedToast = { textContent: "Operation success", dataset: {}, getAttribute: () => null, getClientRects: () => [1] };
  const documentFixture = { querySelectorAll: (selector) => ["#submitOrder", ".module-od-submit-order"].includes(selector) ? [root] : selector.includes("toast") || selector.includes("message") || selector.includes("success") ? [unrelatedToast] : [] };
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html", documentFixture);
  const outcome = await adapter.addToCart({ productVerified: true, colorVerified: true, sizeVerified: true, quantityVerified: true, priceVerified: true }, { attempts: 1, intervalMs: 0 });
  assert.equal(outcome.code, "ADD_TO_CART_UNCONFIRMED");
  assert.equal(clicks, 1);
});

test("selected-state detection supports option, action, ARIA, data, and checked-input signals", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const node = ({ classes = [], attributes = {}, dataset = {}, parentElement = null, checked = false } = {}) => ({ classList: { contains: (name) => classes.includes(name) }, getAttribute: (name) => attributes[name] ?? null, dataset, parentElement, closest: () => null, querySelector: () => checked ? {} : null });
  const candidate = (element, labelElement = element) => ({ element, labelElement, text: "22\u7801" });
  assert.equal(adapter.isOptionSelected(candidate(node({ classes: ["selected"] }))), true);
  assert.equal(adapter.isOptionSelected(candidate(node({ classes: ["sku-selected"] }))), true);
  assert.equal(adapter.isOptionSelected(candidate(node({ attributes: { "aria-selected": "true" } }))), true);
  assert.equal(adapter.isOptionSelected(candidate(node({ attributes: { "aria-pressed": "true" } }))), true);
  assert.equal(adapter.isOptionSelected(candidate(node({ dataset: { selected: "true" } }))), true);
  assert.equal(adapter.isOptionSelected(candidate(node({ checked: true }))), true);
  assert.equal(adapter.isOptionSelected(candidate(node())), false);
});

test("attribute mapping never selects the first of zero or ambiguous value groups", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  const attribute = { key: "\u5c3a\u7801", value: "22\u7801", normalizedKey: adapter.normalizeVariantText("\u5c3a\u7801"), normalizedValue: adapter.normalizeVariantText("22\u7801") };
  const group = (index) => ({ label: "", normalizedLabel: "", index, options: [{ text: "22\u7801", normalizedText: adapter.normalizeVariantText("22\u7801") }] });
  assert.equal(adapter.mapAttributeToGroup(attribute, []).code, "ATTRIBUTE_GROUP_NOT_FOUND");
  assert.equal(adapter.mapAttributeToGroup(attribute, [group(0), group(1)]).code, "ATTRIBUTE_GROUP_AMBIGUOUS");
});

test("translation detection requires corroborating page-level indicators", async () => {
  const adapter = await loadAdapter("https://detail.1688.com/offer/894128442158.html");
  assert.equal(adapter.isTranslatedDocument({ documentLanguage: "zh-CN", markers: [], originalValuesMissing: false }), false);
  assert.equal(adapter.isTranslatedDocument({ documentLanguage: "en", markers: ["html.translated-ltr"], originalValuesMissing: true }), true);
  assert.equal(adapter.isTranslatedDocument({ documentLanguage: "", markers: [], originalValuesMissing: true }), false);
});

test("worker accepts interactive/complete content before tab completion and retries an early missing receiver", async () => {
  let sends = 0;
  const chrome = { runtime: { onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { get: async () => ({ url: "https://detail.1688.com/offer/894447674850.html", status: "loading" }), sendMessage: async () => { sends += 1; if (sends === 1) throw new Error("Receiving end does not exist"); return { ready: true, documentReadyState: "interactive" }; } } };
  const worker = await loadWorker(chrome);
  await worker.waitForExpectedContent(17, "abb-894447674850", 1000);
  assert.equal(sends, 2);
});

test("worker returns distinct navigation and content readiness failures", async () => {
  const wrongProductChrome = { runtime: { onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { get: async () => ({ url: "https://detail.1688.com/offer/1.html" }), sendMessage: async () => ({ ready: true, documentReadyState: "complete" }) } };
  await assert.rejects((await loadWorker(wrongProductChrome)).waitForExpectedContent(1, "894447674850", 1000), { code: "PRODUCT_PAGE_NAVIGATION_FAILED" });
  const unavailableContentChrome = { runtime: { onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { get: async () => ({ url: "https://detail.1688.com/offer/894447674850.html" }), sendMessage: async () => { throw new Error("Receiving end does not exist"); } } };
  await assert.rejects((await loadWorker(unavailableContentChrome)).waitForExpectedContent(1, "894447674850", 1000), { code: "CONTENT_SCRIPT_NOT_READY" });
});

test("order capture waits for an available receiver and sends capture only after ping readiness", async () => {
  const messages = [];
  let pings = 0;
  const chrome = { runtime: { onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { query: async () => [{ id: 9, url: "https://trade.1688.com/order/detail.htm?orderId=168812345678" }], get: async () => ({ url: "https://trade.1688.com/order/detail.htm?orderId=168812345678" }), sendMessage: async (_tabId, message) => { messages.push(message.type); if (message.type === "BRIDGECART_PING" && ++pings === 1) throw new Error("Receiving end does not exist"); return message.type === "BRIDGECART_PING" ? { ready: true } : { ok: true }; } } };
  const worker = await loadWorker(chrome);
  const capture = await worker.captureProviderOrder([]);
  assert.equal(capture.ok, true);
  assert.deepEqual(messages, ["BRIDGECART_PING", "BRIDGECART_PING", "BRIDGECART_CAPTURE_PROVIDER_ORDER"]);
});

test("order capture rejects unsupported pages and reports a bounded content-script timeout", async () => {
  const unsupported = await loadWorker({ runtime: { onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { get: async () => ({ url: "https://detail.1688.com/offer/1.html" }), sendMessage: async () => ({ ready: true }) } });
  assert.equal(unsupported.isSupportedOrderPageUrl("https://trade.1688.com/order/detail.htm?orderId=1"), true);
  assert.equal(unsupported.isSupportedOrderPageUrl("https://detail.1688.com/offer/1.html"), false);
  await assert.rejects(unsupported.waitForOrderContent(1, 1000), { code: "ORDER_PAGE_NOT_SUPPORTED" });
  const unavailable = await loadWorker({ runtime: { onMessage: { addListener() {} } }, storage: { local: { get: async () => ({}), set: async () => {} } }, tabs: { get: async () => ({ url: "https://trade.1688.com/order/detail.htm?orderId=168812345678" }), sendMessage: async () => { throw new Error("Receiving end does not exist"); } } });
  await assert.rejects(unavailable.waitForOrderContent(1, 1000), { code: "CONTENT_SCRIPT_NOT_READY" });
});

test("1688 cart assistant keeps DOM selectors and actions inside a dedicated adapter", async () => {
  const adapter = await readFile("extension/adapters/1688/adapter.js", "utf8");
  for (const name of ["detectProductPage", "getProviderItemId", "waitForProductUI", "discoverVariantOptions", "findSku", "selectSku", "setQuantity", "parsePrice", "readCurrentUnitPrice", "addToCart"]) assert.match(adapter, new RegExp(`function ${name}`));
  assert.match(adapter, /UNSAFE_TEXT/);
  assert.match(adapter, /CART_TEXT/);
  assert.match(adapter, /\[BridgeCart\]\[1688\]/);
});

test("variant matching is grouped and rediscovered between sequential selections", async () => {
  const adapter = await readFile("extension/adapters/1688/adapter.js", "utf8");
  assert.match(adapter, /function discoverVariantGroups/);
  assert.match(adapter, /groupCount/);
  assert.match(adapter, /normalizedLabel/);
  assert.match(adapter, /const groups = discoverVariantGroups\(\)/);
  assert.match(adapter, /const verifiedGroups = discoverVariantGroups\(\)/);
  assert.match(adapter, /SELECTION_UNCONFIRMED/);
  assert.match(adapter, /selection-before/);
  assert.match(adapter, /selection-after/);
  assert.match(adapter, /const refreshedGroups = discoverVariantGroups\(\)/);
  assert.match(adapter, /SELECTION_NOT_CONFIRMED/);
  assert.match(adapter, /SKU_NOT_FOUND/);
});

test("price changes require a product-wide explicit override and are rechecked before cart addition", async () => {
  const [content, adapter, popup, background] = await Promise.all([readFile("extension/content.js", "utf8"), readFile("extension/adapters/1688/adapter.js", "utf8"), readFile("extension/popup.js", "utf8"), readFile("extension/background.js", "utf8")]);
  assert.match(content, /"needs-review"/);
  assert.match(adapter, /QUANTITY_FAILED/);
  assert.match(content, /"PRICE_CHANGED"/);
  assert.match(content, /PRICE_CHANGED_AGAIN/);
  assert.match(content, /priceLines/);
  assert.match(popup, /Add all approved SKUs/);
  assert.match(popup, /Cancel/);
  assert.match(popup, /Expected \$\{formatCny/);
  assert.match(popup, /Current \$\{formatCny/);
  assert.match(popup, /BRIDGECART_APPROVE_PRICE_OVERRIDE/);
  assert.match(background, /PRICE_REVIEW_NOT_FOUND/);
  assert.match(background, /BRIDGECART_PRICE_OVERRIDE/);
  assert.match(background, /priceLines/);
  assert.match(content, /const cart = await adapter\.addToCart\(\{/);
  assert.ok(content.indexOf("PRICE_CHANGED") < content.indexOf("adapter.addToCart({"));
  assert.ok(content.indexOf("PRICE_CHANGED_AGAIN") < content.indexOf("adapter.addToCart({"));
  assert.match(content, /adapter\.detectTranslation\(sku\)/);
  assert.ok(content.indexOf("detectTranslation(sku)") < content.indexOf("adapter.findSku(sku)"));
});

test("popup/background handshake waits for an injected content script and persists progress", async () => {
  const [popup, background, content] = await Promise.all([readFile("extension/popup.js", "utf8"), readFile("extension/background.js", "utf8"), readFile("extension/content.js", "utf8")]);
  assert.match(popup, /extensionApiFetch\("\/api\/extension\/purchase-queue"\)/);
  assert.match(popup, /Open \/ Prepare product on 1688/);
  assert.match(popup, /Expected \$\{formatCny/);
  assert.match(popup, /BRIDGECART_START_PREPARATION/);
  assert.match(background, /waitForExpectedContent/);
  assert.match(background, /BRIDGECART_PING/);
  assert.match(background, /chrome\.tabs\.create/);
  assert.match(background, /cartPreparationStates/);
  assert.match(background, /BRIDGECART_PREPARE_CART/);
  assert.match(background, /BRIDGECART_APPROVE_PRICE_OVERRIDE/);
  assert.match(background, /purchase-cart-result/);
  assert.match(content, /BRIDGECART_PING/);
});

test("manifest injects the 1688 adapter and has no Taobao automation permission", async () => {
  const manifest = await readFile("extension/manifest.json", "utf8");
  assert.match(manifest, /"https:\/\/\*\.1688\.com\/\*"/);
  assert.match(manifest, /"https:\/\/1688\.com\/\*"/);
  assert.doesNotMatch(manifest, /taobao|tmall|scripting/i);
  assert.match(manifest, /adapters\/1688\/adapter\.js/);
  assert.match(manifest, /"service_worker": "background\.js"/);
});
