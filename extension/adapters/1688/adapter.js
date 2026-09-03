(() => {
  const LOG_PREFIX = "[BridgeCart][1688]";
  const SELECTORS = {
    productRoots: ["#offer-detail", "#detailContent", "[class*='offer-detail' i]", "[class*='detail-content' i]", "main"],
    variantGroups: ["[data-sku-prop-id]", "[data-property-id]", "[data-sku-group]", "[role='radiogroup']", "[class*='sku' i][class*='row' i]", "[class*='sku' i][class*='line' i]", "[class*='sku' i][class*='prop' i]", "[class*='sku' i][class*='item' i]", "[class*='spec' i][class*='row' i]", "[class*='spec' i][class*='line' i]", "[class*='spec' i][class*='item' i]", "[class*='property' i][class*='row' i]"],
    variantOptions: ["span.item-label", "[data-sku-id]", "[data-sku_id]", "[data-sku]", "[data-value-id]", "[data-vid]", "[data-value]", "[role='radio']", "button", "li", "a"],
    groupLabels: ["[data-sku-label]", "[data-property-name]", "[class*='sku' i][class*='label' i]", "[class*='spec' i][class*='label' i]", "[class*='prop' i][class*='label' i]", "[class*='title' i]", "dt", "label"],
    quantityInputs: ["input.ant-input-number-input", ".item-input-number input", ".ant-input-number-wrapper input[type='text']", ".ant-input-number-wrapper input[type='number']", "input[data-role='quantity']", "input[name*='quantity' i]", "input[class*='quantity' i]", "input[class*='amount' i]", "input[type='number']"],
    price: ["[data-price]", "[data-role*='price' i]", "[class*='sku-price' i]", "[class*='sale-price' i]", "[class*='price-current' i]", "[class*='price' i]"],
    cartButtons: ["button", "a", "div[role='button']"],
    success: ["[class*='toast' i]", "[class*='message' i]", "[class*='success' i]"],
    cartCount: ["[data-cart-count]", "[data-role='purchase-cart-count']", "[class*='purchase-cart' i] [class*='count' i]", "[class*='purchase-cart' i] [class*='badge' i]", "#submitOrder [class*='cart' i][class*='count' i]", "#submitOrder [class*='cart' i][class*='badge' i]"],
    orderRoots: ["[data-order-id]", "[class*='order-detail' i]", "[class*='trade-detail' i]", "[class*='order-success' i]"],
    orderLines: ["[data-order-line]", "[data-offer-id]", "[class*='order-item' i]", "[class*='trade-item' i]"],
    matrixBlocks: [".expand-view-list-wrapper", ".expand-view-list"],
    matrixRows: [".expand-view-list .expand-view-item", ".expand-view-list-wrapper .expand-view-item"],
    featureItems: [".feature-item"],
    featureLabel: [".feature-item-label h3"],
    featureColorButtons: ["button.sku-filter-button"],
    featureColorLabel: ["span.label-name"],
    matrixColorControls: ["[data-color]", "[data-value]", "[data-value-name]", "[data-property-value]", "[data-sku-prop-value]", "[aria-label]", "[title]", "img[alt]"],
  };
  const CART_TEXT = ["\u52a0\u5165\u8fdb\u8d27\u5355", "\u52a0\u5165\u8d2d\u7269\u8f66", "\u52a0\u91c7\u8d2d\u8f66", "add to cart"];
  const UNSAFE_TEXT = ["\u7acb\u5373\u8d2d\u4e70", "\u7ed3\u7b97", "\u652f\u4ed8", "\u4ed8\u6b3e", "buy now", "checkout", "pay now", "submit order"];
  const UNSAFE_CART_ACTIONS = ["ORDER", "CROSS_BORDER_PUBLISH", "CONSIGN_DF", "ADD_CONSIGN", "DX_ORDER"];
  const SELECTED_CLASSES = ["selected", "active", "is-selected", "checked", "current", "sku-selected"];
  const DISABLED_CLASSES = ["disabled", "is-disabled", "unavailable", "sold-out"];
  const ATTRIBUTE_GROUP_ALIASES = {
    "\u989c\u8272": ["\u989c\u8272", "\u989c\u8272\u5206\u7c7b", "\u8272\u53f7"],
    "\u5c3a\u7801": ["\u5c3a\u7801", "\u5c3a\u7801\u9009\u62e9", "\u7801\u6570", "\u5c3a\u7801\u89c4\u683c"],
    "\u89c4\u683c": ["\u89c4\u683c", "\u89c4\u683c\u578b\u53f7", "\u578b\u53f7"],
  };
  const result = (ok, code, message, extra = {}) => ({ ok, code, message, ...extra });
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const loggedMatrixContexts = new WeakSet();

  function diagnostic(step, extra = {}) {
    console.info(LOG_PREFIX, { step, url: window.location.href, readyState: document.readyState, ...extra });
  }
  function normalize(value) {
    return String(value ?? "").normalize("NFKC").replace(/[\s\u3000]+/g, " ").replace(/[，,;；/|]+/g, " ").trim().toLocaleLowerCase();
  }
  function normalizeProviderItemId(value) { return String(value ?? "").trim().replace(/^abb-/i, "").replace(/^offer-/i, ""); }
  function getDirectText(element) { return [...(element?.childNodes || [])].filter((node) => node.nodeType === 3).map((node) => node.textContent || "").join(" ").replace(/\s+/g, " ").trim(); }
  function visible(element) { const style = window.getComputedStyle(element); return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0; }
  function uniqueElements(selectors) { return [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]).filter(visible))]; }
  function hasClass(element, classes) { return classes.some((name) => element.classList.contains(name) || element.closest(`.${name}`)); }
  function textFor(element) { return element.getAttribute("aria-label") || element.getAttribute("title") || element.dataset.valueName || element.dataset.name || element.textContent || ""; }
  function providerSkuIdFor(element) { return element.dataset.skuId || element.dataset.sku_id || element.dataset.sku || element.getAttribute("data-sku-id") || element.getAttribute("data-sku") || null; }
  function boundedStateElements(candidate) {
    const elements = [];
    for (const start of [candidate.element, candidate.labelElement]) {
      let current = start;
      for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) if (!elements.includes(current)) elements.push(current);
    }
    return elements;
  }
  function stateSnapshot(candidate) {
    const elements = boundedStateElements(candidate);
    const primary = candidate.labelElement || candidate.element;
    const action = candidate.element;
    return { optionText: candidate.text, optionTag: primary?.tagName || "", optionClass: primary?.className || "", actionTag: action?.tagName || "", actionClass: action?.className || "", ariaSelected: action?.getAttribute("aria-selected") || primary?.getAttribute("aria-selected") || null, ariaPressed: action?.getAttribute("aria-pressed") || primary?.getAttribute("aria-pressed") || null, dataAttributes: elements.map((element) => ({ selected: element.dataset?.selected || null, state: element.dataset?.state || null, status: element.dataset?.status || null })), selected: isOptionSelected(candidate) };
  }
  function isOptionSelected(candidate) {
    return boundedStateElements(candidate).some((element) => element.getAttribute("aria-selected") === "true" || element.getAttribute("aria-checked") === "true" || element.getAttribute("aria-pressed") === "true" || element.dataset?.selected === "true" || /^(selected|checked|active)$/i.test(element.dataset?.state || "") || /^(selected|checked|active)$/i.test(element.dataset?.status || "") || hasClass(element, SELECTED_CLASSES) || Boolean(element.querySelector?.("input[type='radio']:checked, input[type='checkbox']:checked")));
  }

  function getProviderItemId() {
    try {
      const url = new URL(window.location.href);
      if (!(url.hostname === "1688.com" || url.hostname.endsWith(".1688.com"))) return null;
      return url.searchParams.get("offerId") || url.searchParams.get("id") || url.pathname.match(/^\/offer\/(\d+)\.html/i)?.[1] || url.pathname.match(/(?:offer|detail)\/(\d+)/)?.[1] || url.pathname.match(/(\d+)\.html/)?.[1] || null;
    } catch { return null; }
  }
  function detectProductPage() {
    const providerItemId = getProviderItemId();
    const rootDetected = uniqueElements(SELECTORS.productRoots).length > 0 || discoverVariantGroups({ log: false }).length > 0 || uniqueElements(SELECTORS.quantityInputs).length > 0;
    diagnostic("detect-product-page", { providerItemId, rootDetected });
    return providerItemId ? result(true, "PRODUCT_PAGE_DETECTED", "Supported 1688 product page detected.", { providerItemId, rootDetected }) : result(false, "UNSUPPORTED_PAGE", "Open the original 1688 product page before preparing this item.", { rootDetected });
  }
  function sameProviderItem(left, right) { return normalizeProviderItemId(left) === normalizeProviderItemId(right); }
  function actionElementFor(labelElement) {
    if (!labelElement.matches("span.item-label")) return labelElement;
    let current = labelElement.parentElement;
    for (let depth = 0; current && depth < 5; depth += 1, current = current.parentElement) {
      if (current.matches("[role='radio'], button, a, li, [data-sku-id], [data-sku], [data-value-id], [data-vid], [class*='expand-view-item' i]")) return current;
    }
    return labelElement.parentElement || labelElement;
  }
  function optionCandidate(labelElement) {
    const element = actionElementFor(labelElement);
    const text = textFor(labelElement).trim();
    const candidate = { element, labelElement, source: labelElement.matches("span.item-label") ? "item-label" : "standard", text, normalizedText: normalize(text), attributes: { skuId: providerSkuIdFor(element), valueId: element.dataset.valueId || element.dataset.vid || labelElement.dataset.valueId || labelElement.dataset.vid || null }, disabled: element.disabled || element.getAttribute("aria-disabled") === "true" || hasClass(element, DISABLED_CLASSES) };
    return { ...candidate, selected: isOptionSelected(candidate) };
  }
  function optionsIn(root) {
    const byAction = new Map();
    for (const labelElement of [...new Set(SELECTORS.variantOptions.flatMap((selector) => [...root.querySelectorAll(selector)]))].filter(visible)) {
      const candidate = optionCandidate(labelElement);
      if ((candidate.normalizedText || candidate.attributes.skuId) && candidate.text.length <= 80 && !byAction.has(candidate.element)) byAction.set(candidate.element, candidate);
    }
    return [...byAction.values()];
  }
  function itemLabelGroupRoot(labelElement) {
    let current = labelElement.parentElement;
    for (let depth = 0; current && depth < 6; depth += 1, current = current.parentElement) {
      if (current.querySelectorAll("span.item-label").length > 1) return current;
    }
    return labelElement.parentElement;
  }
  function labelForGroup(root) { const label = SELECTORS.groupLabels.flatMap((selector) => [...root.querySelectorAll(selector)]).find(visible); return label ? textFor(label).trim() : ""; }
  function discoverVariantGroups(options = {}) {
    const roots = uniqueElements(SELECTORS.variantGroups);
    const groups = [];
    for (const root of roots) {
      if (roots.some((other) => other !== root && root.contains(other))) continue;
      const groupOptions = optionsIn(root);
      if (groupOptions.length < 1) continue;
      groups.push({ element: root, label: labelForGroup(root), normalizedLabel: normalize(labelForGroup(root)), options: groupOptions });
    }
    for (const labelElement of uniqueElements(SELECTORS.groupLabels)) {
      const root = labelElement.parentElement;
      if (!root || groups.some((group) => group.element === root || group.element.contains(root) || root.contains(group.element))) continue;
      const nestedLabels = SELECTORS.groupLabels.flatMap((selector) => [...root.querySelectorAll(selector)]).filter(visible);
      const groupOptions = optionsIn(root);
      if (nestedLabels.length === 1 && groupOptions.length > 0) groups.push({ element: root, label: textFor(labelElement).trim(), normalizedLabel: normalize(textFor(labelElement)), options: groupOptions });
    }
    const itemLabels = uniqueElements(["span.item-label"]);
    diagnostic("item-label-discovery", { count: itemLabels.length, labels: itemLabels.slice(0, 16).map((element) => textFor(element).trim()) });
    for (const itemLabel of itemLabels) {
      const root = itemLabelGroupRoot(itemLabel);
      if (!root || groups.some((group) => group.element === root || group.element.contains(root) || root.contains(group.element))) continue;
      const groupOptions = optionsIn(root);
      if (groupOptions.length > 0) groups.push({ element: root, label: labelForGroup(root), normalizedLabel: normalize(labelForGroup(root)), options: groupOptions });
    }
    const discovered = groups.map((group, index) => ({ ...group, index }));
    if (options.log !== false) diagnostic("discover-variants", { groupCount: discovered.length, groups: discovered.map((group) => ({ label: group.label || `group-${group.index + 1}`, candidateCount: group.options.length, labels: group.options.slice(0, 16).map((candidate) => candidate.text), source: group.options.some((candidate) => candidate.source === "item-label") ? "item-label" : "standard" })) });
    return discovered;
  }
  function discoverVariantOptions() { return discoverVariantGroups().flatMap((group) => group.options); }
  function detectInteractionMode() {
    const rowCount = discoverMatrixGroups().reduce((count, group) => count + group.rows.length, 0);
    const mode = rowCount > 0 ? "SKU_MATRIX_MODE" : "CLASSIC_VARIANT_MODE";
    diagnostic("interaction-mode", { mode, matrixRowCount: rowCount });
    return { mode, rowCount };
  }
  function parseStock(value) { const match = String(value ?? "").match(/\u5e93\u5b58\s*(\d+)/); return match ? Number(match[1]) : null; }
  function parseMatrixRowPrice(rowElement, rowText) {
    const priceElement = rowElement.querySelector("[data-price], [class*='price' i]");
    const elementPrice = priceElement ? parsePrice(priceElement.getAttribute("data-price") || priceElement.textContent) : null;
    if (elementPrice !== null) return elementPrice;
    const prices = [...String(rowText ?? "").matchAll(/(?:\u00a5|\uffe5|cny\s*)(\d+(?:\.\d{1,2})?)/gi)].map((match) => Number(match[1]));
    return prices.length === 1 ? prices[0] : null;
  }
  function matrixRowCandidate(rowElement) {
    const labelElement = rowElement.querySelector("span.item-label");
    const label = labelElement ? textFor(labelElement).trim() : "";
    const rowText = rowElement.innerText || rowElement.textContent || "";
    const quantityControl = rowQuantityControl(rowElement);
    return { rowElement, labelElement, label, normalizedLabel: normalize(label), price: parseMatrixRowPrice(rowElement, rowText), stock: parseStock(rowText), quantityInput: quantityControl.inputElement, quantityControl, plusButton: quantityControl.plusButton, minusButton: quantityControl.minusButton, disabled: hasClass(rowElement, DISABLED_CLASSES) || /\u552e\u7f44|sold out/i.test(rowText) };
  }
  function rowQuantityControl(rowElement) {
    const inputElement = SELECTORS.quantityInputs.flatMap((selector) => [...rowElement.querySelectorAll(selector)]).find((input) => visible(input) && !input.disabled && !input.readOnly) || null;
    const wrapperElement = inputElement?.closest?.(".ant-input-number-wrapper") || inputElement?.closest?.(".item-input-number") || null;
    const controls = [...(wrapperElement?.querySelectorAll?.("[aria-label='plus'], [aria-label='minus'], .ant-input-number-handler-up, .ant-input-number-handler-down, [class*='handler-up' i], [class*='handler-down' i], [aria-label*='increase' i], [aria-label*='decrease' i], button, [role='button']") || [])];
    const clickable = (element) => element?.closest?.("button, [role='button'], .ant-input-number-handler-up, .ant-input-number-handler-down") || element || null;
    const plusButton = clickable(controls.find((element) => /(^plus$|handler-up|increase)/i.test(element.getAttribute?.("aria-label") || "") || /handler-up|increase/i.test(String(element.className || "")) || /^(\+|\uff0b)$/.test(normalize(textFor(element)))));
    const minusButton = clickable(controls.find((element) => /(^minus$|handler-down|decrease)/i.test(element.getAttribute?.("aria-label") || "") || /handler-down|decrease/i.test(String(element.className || "")) || /^(\-|\u2212)$/.test(normalize(textFor(element)))));
    return { inputElement, wrapperElement, plusButton, minusButton };
  }
  function matrixContextValues(element) {
    const values = [];
    const add = (value, splitLabel = false) => {
      const text = String(value ?? "").trim();
      if (!text || text.length > 80) return;
      const exact = splitLabel && /[:：]/.test(text) ? text.split(/[:：]/).at(-1).trim() : text;
      if (exact) values.push(exact);
    };
    for (const name of element.getAttributeNames?.() || []) if (/^(aria-label|title|alt|data-(?:color|value|value-name|property-value|sku-prop-value|sku-value))$/i.test(name)) add(element.getAttribute(name));
    const className = String(element.className || "");
    if (/color|sku|spec|prop|header|title|label/i.test(className) || /^(H[1-6]|DT|LABEL|BUTTON|A|LI)$/i.test(element.tagName || "")) add(getDirectText(element) || textFor(element), true);
    return values;
  }
  function matrixLocalContext(block) {
    const elements = [block];
    let current = block.parentElement;
    for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) {
      elements.push(current);
      const children = [...(current.children || [])];
      const blockChild = children.find((child) => child === block || child.contains?.(block));
      const index = children.indexOf(blockChild);
      for (const sibling of children.slice(Math.max(0, index - 2), index)) elements.push(sibling);
    }
    return [...new Set(elements)];
  }
  function matrixRowsIn(block) {
    return [...new Set(SELECTORS.matrixRows.flatMap((selector) => [...block.querySelectorAll(selector)]).filter((row) => visible(row) && row.querySelector("span.item-label")))].map((row) => matrixRowCandidate(row)).filter((row) => row.normalizedLabel);
  }
  function featureItemsForLabel(label) {
    const expected = normalize(label);
    return uniqueElements(SELECTORS.featureItems).filter((item) => {
      const heading = SELECTORS.featureLabel.flatMap((selector) => [...item.querySelectorAll(selector)]).find(visible);
      return heading && normalize(heading.innerText || heading.textContent) === expected;
    });
  }
  function featureColorControls(featureItem) {
    return SELECTORS.featureColorButtons.flatMap((selector) => [...featureItem.querySelectorAll(selector)]).filter(visible).map((buttonElement) => {
      const labelElement = SELECTORS.featureColorLabel.flatMap((selector) => [...buttonElement.querySelectorAll(selector)]).find(visible);
      const value = String(labelElement?.innerText || labelElement?.textContent || "").trim();
      return { value, normalizedValue: normalize(value), buttonElement, selected: buttonElement.classList.contains("active") || isOptionSelected({ element: buttonElement, labelElement: labelElement || buttonElement, text: value }), disabled: buttonElement.disabled || buttonElement.getAttribute("aria-disabled") === "true" || hasClass(buttonElement, DISABLED_CLASSES) };
    }).filter((control) => control.value);
  }
  function discoverFeatureColorControls() {
    const sections = featureItemsForLabel("颜色");
    if (sections.length !== 1) return result(false, sections.length ? "COLOR_CONTROL_AMBIGUOUS" : "COLOR_CONTROL_NOT_FOUND", sections.length ? "Multiple 1688 color sections were found." : "1688 color section was not found.");
    const controls = featureColorControls(sections[0]);
    diagnostic("color-controls", { values: controls.map((control) => control.value), selected: controls.find((control) => control.selected)?.value || null });
    return result(true, "COLOR_CONTROLS_DISCOVERED", "1688 color controls discovered.", { section: sections[0], controls });
  }
  function matchFeatureColorControl(controls, requestedValue) {
    const matches = controls.filter((control) => control.normalizedValue === normalize(requestedValue));
    diagnostic("color-match", { requested: requestedValue, matched: matches.length === 1, currentlySelected: matches.length === 1 ? matches[0].selected : false });
    if (matches.length === 1) return result(true, "COLOR_CONTROL_MATCHED", "Exact color control matched.", { control: matches[0] });
    return result(false, matches.length ? "COLOR_CONTROL_AMBIGUOUS" : "COLOR_CONTROL_NOT_FOUND", matches.length ? `Multiple color controls match requested value: ${requestedValue}.` : `No color control matches requested value: ${requestedValue}.`);
  }
  async function selectFeatureColor(requestedValue) {
    const discovered = discoverFeatureColorControls();
    if (!discovered.ok) return discovered;
    const matched = matchFeatureColorControl(discovered.controls, requestedValue);
    if (!matched.ok) return matched;
    if (matched.control.disabled) return result(false, "COLOR_SELECTION_NOT_CONFIRMED", `Requested color is unavailable: ${requestedValue}.`);
    if (!matched.control.selected) matched.control.buttonElement.click();
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await sleep(150);
      const refreshed = discoverFeatureColorControls();
      if (!refreshed.ok) continue;
      const verified = matchFeatureColorControl(refreshed.controls, requestedValue);
      if (verified.ok && verified.control.selected) {
        diagnostic("color-select", { requested: requestedValue, verified: true, activeValue: verified.control.value });
        return result(true, "COLOR_SELECTED", "Requested color selected.", { control: verified.control });
      }
    }
    diagnostic("color-select", { requested: requestedValue, verified: false, activeValue: null });
    return result(false, "COLOR_SELECTION_NOT_CONFIRMED", `1688 did not confirm requested color: ${requestedValue}.`);
  }
  function matrixBlocksIn(root) {
    const blocks = [...new Set(SELECTORS.matrixBlocks.flatMap((selector) => [...root.querySelectorAll(selector)]).filter(visible))];
    return blocks.filter((block) => !blocks.some((other) => other !== block && other.contains(block)));
  }
  function sizeMatrixGroup() {
    const sections = featureItemsForLabel("尺码");
    if (sections.length !== 1) return result(false, sections.length ? "MATRIX_GROUP_AMBIGUOUS" : "MATRIX_GROUP_NOT_FOUND", sections.length ? "Multiple 1688 size sections were found." : "1688 size section was not found.");
    const groups = matrixBlocksIn(sections[0]).map((element) => ({ element, rows: matrixRowsIn(element).map((row) => ({ ...row, groupElement: element })) })).filter((group) => group.rows.length > 0);
    if (groups.length !== 1) return result(false, groups.length ? "MATRIX_GROUP_AMBIGUOUS" : "MATRIX_GROUP_NOT_FOUND", groups.length ? "Multiple size matrices were found." : "1688 size matrix was not found.");
    diagnostic("size-matrix", { rowCount: groups[0].rows.length });
    return result(true, "SIZE_MATRIX_DISCOVERED", "1688 size matrix discovered.", { group: groups[0] });
  }
  function describeMatrixElement(element) {
    if (!element) return null;
    const dataAttributes = Object.fromEntries((element.getAttributeNames?.() || []).filter((name) => /^(data-|title$|alt$)/i.test(name)).slice(0, 12).map((name) => [name, element.getAttribute(name)]));
    return { tag: element.tagName || null, className: String(element.className || "").slice(0, 160), directText: getDirectText(element).slice(0, 160), dataAttributes };
  }
  function logMatrixGroupContext(block, wrapperIndex, rows) {
    if (loggedMatrixContexts.has(block)) return;
    loggedMatrixContexts.add(block);
    const parent = block.parentElement;
    const siblings = [...(parent?.children || [])];
    const index = siblings.indexOf(block);
    const ancestors = [];
    for (let current = block.parentElement, depth = 0; current && depth < 4; current = current.parentElement, depth += 1) ancestors.push(describeMatrixElement(current));
    const nearbyControls = matrixLocalContext(block).flatMap((context) => [...context.querySelectorAll?.(SELECTORS.matrixColorControls.join(", ")) || []]).filter((element) => !block.contains(element)).slice(0, 16).map(describeMatrixElement);
    diagnostic("matrix-group-context", { wrapperIndex, rowLabels: rows.slice(0, 3).map((row) => row.label), previousSibling: describeMatrixElement(siblings[index - 1]), nextSibling: describeMatrixElement(siblings[index + 1]), parent: describeMatrixElement(parent), parentChildren: siblings.slice(0, 12).map(describeMatrixElement), ancestors, wrapperAttributes: describeMatrixElement(block)?.dataAttributes || {}, nearbyControls });
  }
  function discoverMatrixGroups() {
    const matrixBlocks = uniqueElements(SELECTORS.matrixBlocks);
    const blocks = matrixBlocks.filter((block) => !matrixBlocks.some((other) => other !== block && other.contains(block)));
    const groups = blocks.map((element, index) => {
      const values = [...new Set(matrixLocalContext(element).flatMap(matrixContextValues))];
      const rows = matrixRowsIn(element).map((row) => ({ ...row, groupElement: element }));
      logMatrixGroupContext(element, index, rows);
      return { element, values, normalizedValues: values.map(normalize), rows };
    }).filter((group) => group.rows.length > 0);
    diagnostic("matrix-groups", { count: groups.length, groups: groups.map((group) => ({ value: group.values.length === 1 ? group.values[0] : null, values: group.values, rowCount: group.rows.length })) });
    return groups;
  }
  function discoverSkuMatrix() { return discoverMatrixGroups().flatMap((group) => group.rows); }
  function setInputQuantity(input, quantity) {
    const setter = typeof HTMLInputElement === "undefined" ? null : Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(input, String(quantity)); else input.value = String(quantity);
    input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); input.dispatchEvent(new Event("blur", { bubbles: true }));
    return Number(input.value) === Number(quantity);
  }
  function rowQuantitySnapshot(rows, target) {
    const occurrences = new Map();
    return rows.filter((row) => row !== target && row.quantityInput).map((row) => {
      const occurrence = occurrences.get(row.normalizedLabel) || 0;
      occurrences.set(row.normalizedLabel, occurrence + 1);
      return { occurrence, label: row.normalizedLabel, quantity: quantityValue(row.quantityInput) };
    });
  }
  function quantityValue(input) {
    const raw = String(input?.value ?? "").trim();
    if (!raw) return 0;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }
  function rowsInMatrixGroup(group) { return matrixRowsIn(group.element).map((row) => ({ ...row, groupElement: group.element })); }
  function exactMatrixRow(group, normalizedLabel) {
    const matches = rowsInMatrixGroup(group).filter((row) => row.normalizedLabel === normalizedLabel);
    return matches.length === 1 ? matches[0] : null;
  }
  async function setMatrixRowQuantity(group, row, requestedQuantity) {
    const control = row.quantityControl;
    diagnostic("row-quantity-control", { row: row.label, found: Boolean(control.inputElement), inputClass: control.inputElement?.className || null, initialValue: control.inputElement?.value ?? null });
    if (!control.inputElement) return result(false, "ROW_QUANTITY_CONTROL_NOT_FOUND", `No quantity control exists for SKU row: ${row.label}.`);
    let refreshedRow = row, current = quantityValue(row.quantityInput), strategy = "stepper-controls";
    if (current === null) return result(false, "QUANTITY_INTERACTION_FAILED", `Current quantity could not be read for SKU row: ${row.label}.`);
    const delta = Number(requestedQuantity) - current;
    diagnostic("quantity-strategy", { mode: "SKU_MATRIX_MODE", strategy, current, requested: Number(requestedQuantity), delta });
    if (Math.abs(delta) > 25) return result(false, "QUANTITY_REQUIRES_MANUAL_REVIEW", "Requested quantity requires too many automated quantity changes.");
    if (delta !== 0 && !control.wrapperElement) {
      strategy = "direct-input-fallback";
      setInputQuantity(control.inputElement, requestedQuantity);
      await sleep(120);
      refreshedRow = exactMatrixRow(group, row.normalizedLabel);
    } else {
      const action = delta > 0 ? "plus" : "minus";
      for (let step = 0; step < Math.abs(delta); step += 1) {
        const button = action === "plus" ? refreshedRow.plusButton : refreshedRow.minusButton;
        if (!button) return result(false, action === "plus" ? "ROW_PLUS_CONTROL_NOT_FOUND" : "ROW_MINUS_CONTROL_NOT_FOUND", `No row-local ${action} control exists for SKU row: ${row.label}.`);
        const before = current;
        button.click();
        await sleep(100);
        refreshedRow = exactMatrixRow(group, row.normalizedLabel);
        const after = refreshedRow ? quantityValue(refreshedRow.quantityInput) : null;
        const verified = after === before + (action === "plus" ? 1 : -1);
        diagnostic("quantity-step", { action, before, after, verified });
        if (!verified) return result(false, "QUANTITY_INTERACTION_FAILED", `1688 did not apply the row-local ${action} action.`);
        current = after;
      }
    }
    const finalValue = refreshedRow ? quantityValue(refreshedRow.quantityInput) : null;
    const verified = finalValue === Number(requestedQuantity);
    diagnostic("set-row-quantity", { row: row.label, requested: requestedQuantity, strategy, finalValue: refreshedRow?.quantityInput?.value ?? null, verified });
    return verified ? result(true, "QUANTITY_SET", "Requested row quantity set.", { row: refreshedRow, strategy }) : result(false, "QUANTITY_FAILED", `Quantity could not be verified for SKU row: ${row.label}.`);
  }
  function matrixAttributes(request, rows) { return Object.entries(request.attributes || {}).map(([key, value]) => ({ key, value, normalizedKey: normalize(key), normalizedValue: normalize(value) })).filter((attribute) => attribute.normalizedValue && rows.some((row) => row.normalizedLabel === attribute.normalizedValue)); }
  function matchMatrixGroup(groups, attribute) {
    const matches = groups.filter((group) => group.normalizedValues.includes(attribute.normalizedValue));
    diagnostic("matrix-group-match", { requested: attribute.value, matched: matches.length === 1, matchedGroup: matches.length === 1 ? matches[0].values.find((value) => normalize(value) === attribute.normalizedValue) : null });
    if (matches.length === 1) return result(true, "MATRIX_GROUP_MATCHED", "Exact matrix group matched.", { group: matches[0] });
    return result(false, matches.length ? "MATRIX_GROUP_AMBIGUOUS" : "MATRIX_GROUP_NOT_FOUND", matches.length ? `Multiple matrix groups match requested value: ${attribute.value}.` : `No matrix group matches requested value: ${attribute.value}.`);
  }
  function colorControlCandidate(element, localContainer) {
    const action = element.closest?.("button, a, [role='button'], li, [data-color], [data-value], [data-value-name], [data-property-value], [data-sku-prop-value]") || element;
    const values = [...new Set([...matrixContextValues(element), ...matrixContextValues(action)])];
    const candidate = { element: action, value: values.length === 1 ? values[0] : null, values, title: element.getAttribute?.("title") || action.getAttribute?.("title") || null, alt: element.getAttribute?.("alt") || null, selected: isOptionSelected({ element: action, labelElement: element, text: textFor(element) }), expanded: action.getAttribute?.("aria-expanded") === "true" || element.getAttribute?.("aria-expanded") === "true", dataAttributes: describeMatrixElement(action)?.dataAttributes || {}, localContainer };
    return candidate;
  }
  function discoverMatrixColorControls(groups) {
    const elements = groups.flatMap((group) => matrixLocalContext(group.element).flatMap((context) => [...context.querySelectorAll?.(SELECTORS.matrixColorControls.join(", ")) || []]).map((element) => ({ element, localContainer: context })));
    const candidates = [];
    for (const entry of elements) {
      if (!visible(entry.element) || entry.element.closest?.(".expand-view-item")) continue;
      const candidate = colorControlCandidate(entry.element, entry.localContainer);
      const text = normalize(textFor(candidate.element));
      if (!candidate.values.length || typeof candidate.element.click !== "function" || UNSAFE_TEXT.some((unsafe) => text.includes(normalize(unsafe)))) continue;
      if (!candidates.some((current) => current.element === candidate.element && current.values.join("\u0000") === candidate.values.join("\u0000"))) candidates.push(candidate);
    }
    diagnostic("matrix-color-controls", { values: [...new Set(candidates.flatMap((candidate) => candidate.values))], controls: candidates.map((candidate) => ({ value: candidate.value, values: candidate.values, selected: candidate.selected, expanded: candidate.expanded })) });
    return candidates;
  }
  function matchMatrixColorControl(controls, attribute) {
    const matches = controls.filter((control) => control.values.some((value) => normalize(value) === attribute.normalizedValue));
    diagnostic("matrix-color-match", { requested: attribute.value, matched: matches.length === 1 });
    if (matches.length === 1) return result(true, "COLOR_CONTROL_MATCHED", "Exact color control matched.", { control: matches[0] });
    return result(false, matches.length ? "COLOR_CONTROL_AMBIGUOUS" : "COLOR_CONTROL_NOT_FOUND", matches.length ? `Multiple color controls match requested value: ${attribute.value}.` : `No color control matches requested value: ${attribute.value}.`);
  }
  function matrixSnapshot(groups) { return groups.map((group) => ({ element: group.element, rows: group.rows.map((row) => row.normalizedLabel).join("\u0000") })); }
  async function activateMatrixColor(groups, control, attribute) {
    const before = matrixSnapshot(groups);
    if (!control.selected && !control.expanded) { control.element.click(); await sleep(300); }
    const refreshedGroups = discoverMatrixGroups();
    const structurallyMatched = matchMatrixGroup(refreshedGroups, attribute);
    const changedGroups = refreshedGroups.filter((group) => !before.some((snapshot) => snapshot.element === group.element && snapshot.rows === group.rows.map((row) => row.normalizedLabel).join("\u0000")));
    const domChanged = changedGroups.length > 0 || before.length !== refreshedGroups.length;
    let group = structurallyMatched.ok ? structurallyMatched.group : null;
    if (!group && refreshedGroups.length === 1 && (domChanged || control.selected || control.expanded)) group = refreshedGroups[0];
    if (!group && changedGroups.length === 1) group = changedGroups[0];
    diagnostic("matrix-color-activate", { requested: attribute.value, domChanged, matrixResolved: Boolean(group) });
    if (!group) return result(false, "MATRIX_ACTIVATION_FAILED", "Color activation did not identify one safe matrix group.");
    diagnostic("matrix-active", { rowCount: group.rows.length, firstRows: group.rows.slice(0, 3).map((row) => row.label) });
    return result(true, "MATRIX_GROUP_ACTIVATED", "Color activation resolved the matrix group.", { groups: refreshedGroups, group });
  }
  function matrixRowAttribute(request, rows) {
    const attributes = matrixAttributes(request, rows);
    return attributes.length === 1 ? result(true, "SKU_ROW_ATTRIBUTE", "Exact matrix row attribute identified.", { attribute: attributes[0] }) : result(false, attributes.length ? "SKU_ROW_AMBIGUOUS" : "SKU_ROW_NOT_FOUND", "Could not identify one exact SKU matrix row attribute.");
  }
  async function prepareMatrixRow(group, rowAttribute, request, options = {}) {
    const rows = group.rows;
    const matches = rows.filter((row) => row.normalizedLabel === rowAttribute.normalizedValue);
    diagnostic("sku-row-match", { requestedRow: rowAttribute.value, matched: matches.length === 1 });
    if (matches.length !== 1) return result(false, matches.length ? "SKU_ROW_AMBIGUOUS" : "SKU_ROW_NOT_FOUND", `Could not safely identify SKU row: ${rowAttribute.value}.`);
    const row = matches[0];
    if (row.disabled || (row.stock !== null && row.stock <= 0)) return result(false, "SKU_ROW_NOT_FOUND", `SKU row is unavailable: ${row.label}.`);
    if (!row.quantityInput) return result(false, "ROW_QUANTITY_CONTROL_NOT_FOUND", `No quantity control exists for SKU row: ${row.label}.`);
    const otherRowQuantities = rowQuantitySnapshot(rows, row);
    const quantity = await setMatrixRowQuantity(group, row, request.quantity);
    if (!quantity.ok) return quantity;
    const refreshedRow = quantity.row;
    if (refreshedRow.price === null) return result(false, "PRICE_PARSE_FAILED", `Current price could not be read for SKU row: ${refreshedRow.label}.`);
    const siblingChanged = !options.allowExistingRows && otherRowQuantities.some((snapshot) => {
      const candidates = rowsInMatrixGroup(group).filter((candidate) => candidate.normalizedLabel === snapshot.label);
      return quantityValue(candidates[snapshot.occurrence]?.quantityInput) !== snapshot.quantity;
    });
    diagnostic("sibling-quantity-check", { unchanged: !siblingChanged });
    if (siblingChanged) return result(false, "UNINTENDED_QUANTITY_CHANGE", "Another SKU row quantity changed while preparing this item.");
    const persistedAfterRediscovery = quantityValue(refreshedRow.quantityInput) === Number(request.quantity);
    diagnostic("quantity-state", { requested: Number(request.quantity), actual: quantityValue(refreshedRow.quantityInput), persistedAfterRediscovery, siblingsUnchanged: true, confirmed: persistedAfterRediscovery });
    if (!persistedAfterRediscovery) return result(false, "QUANTITY_INTERACTION_FAILED", "Quantity did not persist after row re-discovery.");
    return result(true, "SKU_MATRIX_READY", "Exact SKU matrix row prepared.", { row: refreshedRow, group, otherRowQuantities, quantityState: "QUANTITY_STATE_CONFIRMED" });
  }
  async function prepareFeatureItemMatrix(request, options = {}) {
    const colorSections = featureItemsForLabel("颜色");
    const sizeSections = featureItemsForLabel("尺码");
    if (!colorSections.length && !sizeSections.length) return null;
    if (colorSections.length !== 1 || sizeSections.length !== 1) return result(false, colorSections.length > 1 || sizeSections.length > 1 ? "MATRIX_GROUP_AMBIGUOUS" : "MATRIX_GROUP_NOT_FOUND", "Confirmed 1688 color and size sections could not be uniquely identified.");
    const colorAttribute = Object.entries(request.attributes || {}).find(([key]) => ATTRIBUTE_GROUP_ALIASES["颜色"].map(normalize).includes(normalize(key)));
    if (!colorAttribute) return result(false, "COLOR_CONTROL_NOT_FOUND", "Requested color attribute was not provided.");
    const selected = await selectFeatureColor(colorAttribute[1]);
    if (!selected.ok) return selected;
    const refreshedSizeGroup = sizeMatrixGroup();
    if (!refreshedSizeGroup.ok) return refreshedSizeGroup;
    const rowAttribute = matrixRowAttribute(request, refreshedSizeGroup.group.rows);
    if (!rowAttribute.ok) return rowAttribute;
    return prepareMatrixRow(refreshedSizeGroup.group, rowAttribute.attribute, request, options);
  }
  async function prepareSkuMatrix(request, options = {}) {
    const featureItemPreparation = await prepareFeatureItemMatrix(request, options);
    if (featureItemPreparation) return featureItemPreparation;
    let groups = discoverMatrixGroups();
    const allRows = groups.flatMap((group) => group.rows);
    const rowAttributeResult = matrixRowAttribute(request, allRows);
    if (!rowAttributeResult.ok) return rowAttributeResult;
    const rowAttribute = rowAttributeResult.attribute;
    const parentAttributes = Object.entries(request.attributes || {}).filter(([, value]) => normalize(value) !== rowAttribute.normalizedValue);
    if (parentAttributes.length !== 1) return result(false, parentAttributes.length ? "MATRIX_GROUP_AMBIGUOUS" : "MATRIX_GROUP_NOT_FOUND", "Could not identify one exact matrix group attribute.");
    const groupAttribute = { key: parentAttributes[0][0], value: parentAttributes[0][1], normalizedValue: normalize(parentAttributes[0][1]) };
    const colorControls = discoverMatrixColorControls(groups);
    const matchedColor = matchMatrixColorControl(colorControls, groupAttribute);
    let matchedGroup = matchMatrixGroup(groups, groupAttribute);
    if (!matchedGroup.ok && matchedGroup.code === "MATRIX_GROUP_NOT_FOUND") {
      if (!matchedColor.ok) return matchedColor;
      const activated = await activateMatrixColor(groups, matchedColor.control, groupAttribute);
      if (!activated.ok) return activated;
      groups = activated.groups;
      matchedGroup = result(true, "MATRIX_GROUP_MATCHED", "Exact matrix group matched.", { group: activated.group });
    }
    if (!matchedGroup.ok) return matchedGroup;
    const group = matchedGroup.group;
    diagnostic("sku-matrix", { groupCount: groups.length, groups: groups.map((candidate) => ({ value: candidate.values.length === 1 ? candidate.values[0] : null, rowCount: candidate.rows.length, rows: candidate.rows.slice(0, 16).map((row) => ({ label: row.label, price: row.price, stock: row.stock, hasQuantityControl: Boolean(row.quantityInput) })) })) });
    return prepareMatrixRow(group, rowAttribute, request, options);
  }
  function skuRequestKey(request) {
    return String(request.providerSkuId || "") + "|" + Object.entries(request.attributes || {}).map(([key, value]) => `${normalize(key)}=${normalize(value)}`).sort().join("|");
  }
  async function prepareSkuMatrixBatch(requests) {
    if (!Array.isArray(requests) || !requests.length) return result(false, "SKU_BATCH_EMPTY", "No SKU rows were supplied for this product.");
    const combined = new Map();
    for (const request of requests) {
      const key = skuRequestKey(request);
      const existing = combined.get(key);
      if (existing) { existing.quantity += Number(request.quantity); existing.orderItemIds.push(request.orderItemId); }
      else combined.set(key, { ...request, quantity: Number(request.quantity), orderItemIds: [request.orderItemId] });
    }
    const prepared = [];
    for (const request of combined.values()) {
      const outcome = await prepareSkuMatrix(request, { allowExistingRows: true });
      if (!outcome.ok) return outcome;
      prepared.push({ request, row: outcome.row });
    }
    for (const entry of prepared) {
      const verified = verifySkuMatrixRow(entry.row, entry.request.quantity);
      if (!verified.ok) return verified;
      entry.row = verified.row;
      if (entry.row.disabled || (entry.row.stock !== null && entry.row.stock < entry.request.quantity) || entry.row.price === null) return result(false, "SKU_ROW_UNAVAILABLE", `SKU row is unavailable or cannot satisfy its quantity: ${entry.row.label}.`);
    }
    return result(true, "SKU_MATRIX_BATCH_READY", "Every requested SKU matrix row is prepared.", { prepared });
  }
  function verifySkuMatrixRow(row, quantity, otherRowQuantities = []) {
    const group = discoverMatrixGroups().find((candidate) => candidate.element === row.groupElement);
    const matches = group?.rows.filter((candidate) => candidate.normalizedLabel === row.normalizedLabel) || [];
    if (matches.length !== 1 || quantityValue(matches[0].quantityInput) !== Number(quantity)) return result(false, "QUANTITY_FAILED", "SKU matrix row quantity could not be re-verified.");
    const changedOtherRow = otherRowQuantities.some((snapshot) => {
      const candidate = group.rows.filter((item) => item.normalizedLabel === snapshot.label)[snapshot.occurrence];
      return !candidate || quantityValue(candidate.quantityInput) !== snapshot.quantity;
    });
    return changedOtherRow ? result(false, "UNINTENDED_QUANTITY_CHANGE", "Another SKU row quantity changed while preparing this item.") : result(true, "SKU_MATRIX_VERIFIED", "SKU matrix row remains prepared.", { row: matches[0] });
  }
  function isTranslatedDocument({ documentLanguage, markers, originalValuesMissing }) {
    const languageSuggestsTranslation = Boolean(documentLanguage && !/^zh(?:-|$)/i.test(documentLanguage));
    return Boolean(originalValuesMissing && (markers.length > 0 || languageSuggestsTranslation));
  }
  function detectTranslation(request) {
    const documentLanguage = document.documentElement.lang || document.lang || "";
    const markerSelectors = ["html.translated-ltr", "html.translated-rtl", "[class*='goog-te' i]", ".goog-te-banner-frame", "[data-translate-status='translated']", "[data-translation='translated']"];
    const markers = markerSelectors.filter((selector) => document.querySelector(selector)).map((selector) => selector);
    const requestedValues = Object.values(request.attributes || {}).map(String).filter((value) => /[\u3400-\u9fff]/.test(value));
    const renderedText = normalize(document.body?.innerText || "");
    const originalValuesMissing = requestedValues.length > 0 && requestedValues.every((value) => !renderedText.includes(normalize(value)));
    const translated = isTranslatedDocument({ documentLanguage, markers, originalValuesMissing });
    diagnostic("translation-check", { translated, documentLanguage, indicators: markers, originalValuesMissing });
    return translated
      ? result(false, "PAGE_TRANSLATED", "1688 is being displayed in translated mode. Switch the page to the original Chinese version and try again.")
      : result(true, "PAGE_NOT_TRANSLATED", "No confident browser-translation indicators were found.");
  }
  function mapAttributeToGroup(attribute, groups) {
    diagnostic("map-attribute", { requestedKey: attribute.key, requestedValue: attribute.value, discoveredGroups: groups.map((group) => ({ label: group.label || `group-${group.index + 1}`, labels: group.options.slice(0, 16).map((option) => option.text) })) });
    const exact = groups.filter((group) => group.normalizedLabel && group.normalizedLabel === attribute.normalizedKey);
    if (exact.length === 1) return mappedGroup(attribute, exact[0], "exact-label");
    if (exact.length > 1) return result(false, "ATTRIBUTE_GROUP_AMBIGUOUS", `Multiple groups match requested attribute: ${attribute.key}.`);
    const aliasSet = Object.values(ATTRIBUTE_GROUP_ALIASES).find((aliases) => aliases.map(normalize).includes(attribute.normalizedKey));
    if (aliasSet) {
      const aliases = aliasSet.map(normalize);
      const aliasMatches = groups.filter((group) => group.normalizedLabel && aliases.includes(group.normalizedLabel));
      if (aliasMatches.length === 1) return mappedGroup(attribute, aliasMatches[0], "label-alias");
      if (aliasMatches.length > 1) return result(false, "ATTRIBUTE_GROUP_AMBIGUOUS", `Multiple alias groups match requested attribute: ${attribute.key}.`);
    }
    const valueMatches = groups.filter((group) => group.options.some((option) => option.normalizedText === attribute.normalizedValue));
    if (valueMatches.length === 1) return mappedGroup(attribute, valueMatches[0], "unique-value");
    return result(false, valueMatches.length ? "ATTRIBUTE_GROUP_AMBIGUOUS" : "ATTRIBUTE_GROUP_NOT_FOUND", valueMatches.length ? `Requested value appears in multiple specification groups: ${attribute.value}.` : `No specification group contains requested value: ${attribute.value}.`);
  }
  function mappedGroup(attribute, group, method) { diagnostic("map-attribute", { requestedKey: attribute.key, method, mappedGroupLabel: group.label || `group-${group.index + 1}`, mappedGroupIndex: group.index }); return result(true, "ATTRIBUTE_GROUP_MAPPED", "Requested attribute mapped.", { group, method }); }
  async function waitForProductUI(timeoutMs = 12000) {
    const ready = () => { const page = detectProductPage(); return page.ok && (discoverVariantOptions().length > 0 || uniqueElements(SELECTORS.quantityInputs).length > 0); };
    if (ready()) return result(true, "PAGE_READY", "1688 product controls are ready.");
    return new Promise((resolve) => {
      let finished = false;
      const finish = (value) => { if (finished) return; finished = true; observer.disconnect(); clearTimeout(timeout); clearInterval(poll); resolve(value); };
      const check = () => { if (ready()) finish(result(true, "PAGE_READY", "1688 product controls are ready.")); };
      const observer = new MutationObserver(check);
      observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "aria-selected", "aria-checked", "disabled"] });
      const poll = setInterval(check, 400);
      const timeout = setTimeout(() => { diagnostic("page-not-ready", { variantCandidateCount: discoverVariantOptions().length, quantityInputCount: uniqueElements(SELECTORS.quantityInputs).length }); finish(result(false, "PAGE_NOT_READY", "1688 product controls did not become ready in time.")); }, timeoutMs);
    });
  }
  function findSku(request) {
    const groups = discoverVariantGroups();
    const candidates = groups.flatMap((group) => group.options);
    const requestedSkuId = normalize(request.providerSkuId);
    if (requestedSkuId) {
      const exact = candidates.filter((candidate) => !candidate.disabled && normalize(candidate.attributes.skuId) === requestedSkuId);
      if (exact.length === 1) return result(true, "SKU_MATCHED", "Provider SKU matched.", { match: { type: "provider_sku", selections: [{ providerSkuId: requestedSkuId, groupIndex: groups.findIndex((group) => group.options.includes(exact[0])) }] } });
      if (exact.length > 1) return result(false, "AMBIGUOUS_MATCH", "More than one selectable page option has the requested provider SKU.");
    }
    const requestedAttributes = Object.entries(request.attributes || {}).map(([key, value]) => ({ key, normalizedKey: normalize(key), value, normalizedValue: normalize(value) })).filter((attribute) => attribute.normalizedValue);
    if (!requestedAttributes.length) return result(false, "NEEDS_REVIEW", "No exact provider SKU or variant attributes are available to match safely.");
    return result(true, "VARIANT_MATCHED", "Requested variant attributes are ready for sequential matching.", { match: { type: "attributes", requestedAttributes } });
  }
  async function selectSku(match) {
    if (match?.type === "provider_sku") return selectProviderSku(match);
    if (!match?.requestedAttributes?.length) return result(false, "NEEDS_REVIEW", "No safe SKU selection was available.");
    const selections = [];
    for (const attribute of match.requestedAttributes) {
      const groups = discoverVariantGroups();
      const mapped = mapAttributeToGroup(attribute, groups);
      if (!mapped.ok) return mapped;
      const group = mapped.group;
      const options = group.options.filter((candidate) => candidate.normalizedText === attribute.normalizedValue);
      if (options.length !== 1) return result(false, options.length ? "AMBIGUOUS_MATCH" : "SKU_NOT_FOUND", `Required variant was unavailable: ${attribute.value}.`);
      const candidate = options[0];
      if (candidate.disabled) return result(false, "SKU_NOT_FOUND", `Required variant is disabled: ${attribute.value}.`);
      diagnostic("selection-before", { requested: attribute.value, ...stateSnapshot(candidate) });
      if (!candidate.selected) candidate.element.click();
      await sleep(250);
      const refreshedGroups = discoverVariantGroups();
      const refreshedMapping = mapAttributeToGroup(attribute, refreshedGroups);
      const refreshedCandidate = refreshedMapping.ok ? refreshedMapping.group.options.find((option) => option.normalizedText === attribute.normalizedValue) : null;
      const selected = Boolean(refreshedCandidate?.selected);
      diagnostic("selection-after", { requested: attribute.value, ...(refreshedCandidate ? stateSnapshot(refreshedCandidate) : { selected: false }) });
      diagnostic("select-variant", { group: group.label || `group-${group.index + 1}`, requested: attribute.value, selected });
      if (!selected) return result(false, "SELECTION_NOT_CONFIRMED", `1688 did not confirm variant selection: ${candidate.text}.`);
      selections.push({ attribute, method: mapped.method });
    }
    const verifiedGroups = discoverVariantGroups();
    for (const selection of selections) {
      const mapped = mapAttributeToGroup(selection.attribute, verifiedGroups);
      if (!mapped.ok || !mapped.group.options.some((candidate) => candidate.selected && candidate.normalizedText === selection.attribute.normalizedValue)) return result(false, "SELECTION_UNCONFIRMED", `1688 did not retain the requested variant: ${selection.attribute.value}.`);
    }
    diagnostic("variant-selected", { selectedCount: selections.length });
    return result(true, "SKU_SELECTED", "Requested SKU selected.");
  }
  async function selectProviderSku(match) {
    const selection = match.selections?.[0];
    const groups = discoverVariantGroups();
    const group = groups[selection?.groupIndex];
    const options = group?.options.filter((candidate) => normalize(candidate.attributes.skuId) === selection.providerSkuId) || [];
    if (options.length !== 1 || options[0].disabled) return result(false, "SKU_NOT_FOUND", "Requested provider SKU was unavailable.");
    if (!options[0].selected) options[0].element.click();
    await sleep(250);
    const refreshed = discoverVariantGroups()[selection?.groupIndex]?.options.find((candidate) => normalize(candidate.attributes.skuId) === selection.providerSkuId);
    return refreshed?.selected ? result(true, "SKU_SELECTED", "Requested SKU selected.") : result(false, "SELECTION_NOT_CONFIRMED", "1688 did not confirm provider SKU selection.");
  }
  function setQuantity(quantity) {
    const inputs = uniqueElements(SELECTORS.quantityInputs).filter((input) => !input.disabled && !input.readOnly);
    diagnostic("set-quantity", { quantityInputCount: inputs.length, requestedQuantity: quantity });
    const input = inputs.find((candidate) => Number(candidate.value) >= 0) || inputs[0];
    if (!input) return result(false, "QUANTITY_FAILED", "Quantity input was not found.");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, String(quantity)); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); input.dispatchEvent(new Event("blur", { bubbles: true }));
    return Number(input.value) === Number(quantity) ? result(true, "QUANTITY_SET", "Requested quantity set.") : result(false, "QUANTITY_FAILED", "Requested quantity could not be verified.", { renderedQuantity: input.value });
  }
  function parsePrice(value) { const text = String(value ?? "").replace(/,/g, ""); if (/\d+(?:\.\d+)?\s*[-~\u2013]\s*\d+(?:\.\d+)?/.test(text)) return null; const match = text.match(/(?:\u00a5|\uffe5|cny\s*)?\s*(\d+(?:\.\d{1,2})?)/i); return match ? Number(match[1]) : null; }
  function readCurrentUnitPrice() {
    const candidates = uniqueElements(SELECTORS.price).map((element) => ({ element, text: textFor(element), price: parsePrice(element.dataset.price || textFor(element)) })).filter((candidate) => candidate.price !== null);
    diagnostic("read-price", { priceCandidateCount: candidates.length, values: candidates.slice(0, 8).map((candidate) => candidate.text) });
    const uniquePrices = [...new Set(candidates.map((candidate) => candidate.price))];
    if (uniquePrices.length !== 1) return result(false, "PRICE_PARSE_FAILED", "Current selected-SKU price could not be identified confidently.", { price: null });
    return result(true, "PRICE_READ", "Current unit price read.", { price: uniquePrices[0] });
  }
  function safeCartButton() {
    const roots = uniqueElements(["#submitOrder", ".module-od-submit-order"]);
    const buttons = [...new Set(roots.flatMap((root) => [
      ...root.querySelectorAll('button[data-click="ADD_CART"][datatype="ADD_CART"]'),
      ...root.querySelectorAll('button[data-click="ADD_CART"]'),
      ...root.querySelectorAll('button[datatype="ADD_CART"]'),
    ]))];
    const candidates = buttons.filter((button) => {
      const dataClick = String(button.getAttribute("data-click") || "").toUpperCase(), datatype = String(button.getAttribute("datatype") || "").toUpperCase(), text = normalize(textFor(button));
      return button.tagName === "BUTTON" && visible(button) && !button.disabled && button.getAttribute("aria-disabled") !== "true" && (dataClick === "ADD_CART" || datatype === "ADD_CART") && !UNSAFE_CART_ACTIONS.includes(dataClick) && !UNSAFE_CART_ACTIONS.includes(datatype) && CART_TEXT.some((label) => text.includes(normalize(label))) && !UNSAFE_TEXT.some((label) => text.includes(normalize(label)));
    });
    return candidates.length === 1 ? candidates[0] : null;
  }
  function cartCountFromText(value) {
    const text = String(value ?? "").replace(/\s+/g, " ").trim();
    const standalone = text.match(/^(\d{1,6})$/);
    const cartLabelled = text.match(/(?:\u8d2d\u7269\u8f66|\u91c7\u8d2d\u8f66|\u8fdb\u8d27\u5355|cart)\s*[(:\uff1a\[]?\s*(\d{1,6})\s*[)\uff09\]]?/i);
    return Number.isSafeInteger(Number(standalone?.[1] || cartLabelled?.[1])) ? Number(standalone?.[1] || cartLabelled?.[1]) : null;
  }
  function getCartState() {
    const candidates = uniqueElements(SELECTORS.cartCount).map((element) => {
      const text = (element.getAttribute("data-cart-count") || textFor(element)).replace(/\s+/g, " ").trim();
      return { text, count: cartCountFromText(text) };
    });
    const counts = [...new Set(candidates.map((candidate) => candidate.count).filter((count) => count !== null))];
    const badgeTexts = [...new Set(candidates.map((candidate) => candidate.text).filter(Boolean))];
    return { count: counts.length === 1 ? counts[0] : null, badgeText: badgeTexts.length === 1 ? badgeTexts[0] : null };
  }
  function hasExplicitCartSuccessToast() {
    return uniqueElements(SELECTORS.success).some((element) => /(?:\u52a0\u5165\u6210\u529f|\u5df2\u52a0\u5165\u91c7\u8d2d\u8f66|\u5df2\u52a0\u5165\u8d2d\u7269\u8f66|\u6dfb\u52a0\u6210\u529f|added to (?:the )?cart|added successfully)/i.test(textFor(element)));
  }
  function cartConfirmationMethod(before, after) {
    if (before.count !== null && after.count !== null && after.count > before.count) return "cart-count";
    if (hasExplicitCartSuccessToast()) return "success-toast";
    if (before.badgeText && after.badgeText && before.badgeText !== after.badgeText) return "cart-state";
    return null;
  }
  async function waitForCartConfirmation(before, { attempts = 12, intervalMs = 250 } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await sleep(intervalMs);
      const after = getCartState();
      diagnostic("cart-state-after", { attempt, ...after });
      const method = cartConfirmationMethod(before, after);
      if (method) return { method, after };
    }
    return { method: null, after: getCartState() };
  }
  async function addToCart(precheck = {}, confirmationOptions = {}) {
    const button = safeCartButton();
    const dataClick = button?.getAttribute("data-click") || null, datatype = button?.getAttribute("datatype") || null;
    diagnostic("add-to-cart-discovery", { found: Boolean(button), text: button ? textFor(button).trim() : null, dataClick, datatype });
    diagnostic("add-to-cart-precheck", { productVerified: precheck.productVerified === true, colorVerified: precheck.colorVerified === true, sizeVerified: precheck.sizeVerified === true, quantityVerified: precheck.quantityVerified === true, priceVerified: precheck.priceVerified === true });
    if (!button || !["productVerified", "colorVerified", "sizeVerified", "quantityVerified", "priceVerified"].every((key) => precheck[key] === true)) return result(false, "ADD_TO_CART_UNCONFIRMED", "A safe add-to-cart action was not found or required checks were incomplete.");
    const before = getCartState();
    diagnostic("cart-state-before", before);
    button.click(); diagnostic("add-to-cart-click", { clicked: true });
    const confirmation = await waitForCartConfirmation(before, confirmationOptions);
    diagnostic("add-to-cart-result", { confirmed: Boolean(confirmation.method), method: confirmation.method });
    return confirmation.method ? result(true, "CART_ADDED", "Item was added to the 1688 cart.", { confirmationMethod: confirmation.method }) : result(false, "ADD_TO_CART_UNCONFIRMED", "Add-to-cart was clicked but 1688 did not confirm it. Review manually.");
  }
  function datasetValue(element, ...keys) { return keys.map((key) => element?.dataset?.[key] || element?.getAttribute?.(`data-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`)).find((value) => String(value || "").trim()) || null; }
  function labelledValue(element, labels) {
    const text = String(element?.innerText || element?.textContent || "").replace(/\s+/g, " ");
    for (const label of labels) {
      const match = text.match(new RegExp(`${label}\\s*[:：]?\\s*([^\\s，,；;]+(?:\\s+[^，,；;]+){0,3})`, "i"));
      if (match?.[1]) return match[1].trim();
    }
    return null;
  }
  function orderIdFromUrl() { try { const url = new URL(window.location.href); return url.searchParams.get("orderId") || url.searchParams.get("tradeId") || url.pathname.match(/(?:order|trade)[^0-9]*(\d{6,})/i)?.[1] || null; } catch { return null; } }
  function detectPostPurchasePage() {
    const roots = uniqueElements(SELECTORS.orderRoots);
    const providerOrderId = roots.map((root) => datasetValue(root, "orderId", "tradeId")).find(Boolean) || orderIdFromUrl();
    const pageType = /success|pay/i.test(window.location.href) ? "ORDER_SUCCESS" : roots.length ? "ORDER_DETAIL" : null;
    diagnostic("detect-order-page", { supported: Boolean(providerOrderId && pageType), pageType, rootCount: roots.length });
    return providerOrderId && pageType ? result(true, "ORDER_PAGE_DETECTED", "Supported 1688 order page detected.", { pageType, providerOrderId }) : result(false, "ORDER_NOT_DETECTED", "Open a supported 1688 order detail or order-success page before capturing.");
  }
  function capturedMoney(element, keys, labels) { const raw = datasetValue(element, ...keys) || labelledValue(element, labels); return raw === null ? null : parsePrice(raw); }
  function captureOrderLine(element, providerOrderId) {
    const providerItemId = datasetValue(element, "offerId", "providerItemId", "itemId") || [...element.querySelectorAll?.("a[href*='offer']") || []].map((link) => link.href?.match(/offer\/(\d+)\.html/i)?.[1]).find(Boolean) || null;
    const attributes = datasetValue(element, "attributes") ? (() => { try { return JSON.parse(datasetValue(element, "attributes")); } catch { return {}; } })() : {};
    const quantityRaw = datasetValue(element, "quantity") || labelledValue(element, ["数量", "qty", "quantity"]);
    const quantity = /^\d+$/.test(String(quantityRaw || "")) ? Number(quantityRaw) : null;
    return { providerOrderId, providerItemId, providerSkuId: datasetValue(element, "skuId", "specId", "providerSkuId"), attributes, quantity,
      actualUnitPriceCny: capturedMoney(element, ["unitPrice", "actualUnitPrice"], ["单价", "unit price"]), productSubtotalCny: capturedMoney(element, ["subtotal", "productSubtotal"], ["商品小计", "小计", "subtotal"]), domesticFreightCny: capturedMoney(element, ["freight", "domesticFreight"], ["运费", "freight"]), actualDiscountCny: capturedMoney(element, ["discount"], ["优惠", "discount"]), paidAmountCny: capturedMoney(element, ["paidAmount", "finalPaid"], ["实付", "付款", "paid"]), sellerName: datasetValue(element, "sellerName") || labelledValue(element, ["卖家", "seller"]), sellerId: datasetValue(element, "sellerId"), providerStatus: datasetValue(element, "providerStatus", "status") || labelledValue(element, ["订单状态", "status"]), sellerTrackingNumber: datasetValue(element, "trackingNumber", "sellerTrackingNumber") || labelledValue(element, ["物流单号", "运单号", "tracking"]), purchasedAt: datasetValue(element, "purchasedAt", "paymentTime") || null };
  }
  function captureProviderOrder() {
    const page = detectPostPurchasePage(); if (!page.ok) return page;
    const lines = uniqueElements(SELECTORS.orderLines).map((element) => captureOrderLine(element, page.providerOrderId)).filter((line) => line.providerItemId || line.providerSkuId || line.quantity !== null);
    if (!lines.length) return result(false, "ORDER_NOT_DETECTED", "1688 order lines could not be identified on this supported page.", { pageType: page.pageType });
    const snapshot = { providerOrderId: page.providerOrderId, pageType: page.pageType, lines: lines.map(({ providerOrderId, providerItemId, providerSkuId, attributes, quantity, actualUnitPriceCny, productSubtotalCny, domesticFreightCny, actualDiscountCny, paidAmountCny, sellerName, sellerId, providerStatus, sellerTrackingNumber, purchasedAt }) => ({ providerOrderId, providerItemId, providerSkuId, attributes, quantity, actualUnitPriceCny, productSubtotalCny, domesticFreightCny, actualDiscountCny, paidAmountCny, sellerName, sellerId, providerStatus, sellerTrackingNumber, purchasedAt })) };
    diagnostic("capture-provider-order", { pageType: page.pageType, lineCount: lines.length, providerOrderId: page.providerOrderId });
    return result(true, "CAPTURED", "1688 order captured for review.", { capture: snapshot });
  }
  function attributesMatch(left = {}, right = {}) { const leftEntries = Object.entries(left); return leftEntries.length > 0 && leftEntries.length === Object.entries(right).length && leftEntries.every(([key, value]) => normalize(right[key]) === normalize(value)); }
  function matchCapturedLine(line, queueItems) {
    const sameOffer = queueItems.filter((item) => sameProviderItem(item.providerItemId, line.providerItemId));
    if (!sameOffer.length) return { state: "ITEM_NOT_MATCHED", line };
    const sku = line.providerSkuId ? sameOffer.filter((item) => normalize(item.providerSkuId) === normalize(line.providerSkuId)) : [];
    const variants = !sku.length ? sameOffer.filter((item) => attributesMatch(item.attributes, line.attributes)) : sku;
    if (variants.length === 1) return { state: "MATCHED", line, item: variants[0] };
    if (variants.length > 1) return { state: "AMBIGUOUS_MATCH", line, candidates: variants.map((item) => item.orderItemId) };
    return { state: line.providerSkuId ? "SKU_MISMATCH" : "ITEM_NOT_MATCHED", line };
  }
  globalThis.BridgeCart1688 = { diagnostic, optionTextFor: textFor, isOptionSelected, normalizeVariantText: normalize, normalizeProviderItemId, sameProviderItem, detectProductPage, getProviderItemId, waitForProductUI, discoverVariantGroups, discoverVariantOptions, detectInteractionMode, discoverFeatureColorControls, matchFeatureColorControl, selectFeatureColor, sizeMatrixGroup, discoverMatrixGroups, discoverMatrixColorControls, discoverSkuMatrix, matchMatrixGroup, matchMatrixColorControl, matrixRowCandidate, setMatrixRowQuantity, prepareSkuMatrix, prepareSkuMatrixBatch, verifySkuMatrixRow, parseStock, isTranslatedDocument, detectTranslation, mapAttributeToGroup, findSku, selectSku, setQuantity, parsePrice, readCurrentUnitPrice, safeCartButton, cartCountFromText, getCartState, hasExplicitCartSuccessToast, waitForCartConfirmation, addToCart, detectPostPurchasePage, captureProviderOrder, matchCapturedLine };
})();
