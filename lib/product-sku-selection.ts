export type SelectionSku = {
  skuId: string;
  priceCny: number;
  availableQuantity?: number;
  attributes: Record<string, string>;
  imageUrl?: string;
};

export type ProductSkuSelectionState = Readonly<{
  filters: Record<string, string>;
  quantitiesBySkuId: Record<string, number>;
}>;

export type SelectedSkuLine<T extends SelectionSku> = Readonly<{
  sku: T;
  quantity: number;
}>;

export type SupplierSelectionSummary = Readonly<{
  selectedSkuCount: number;
  selectedPieces: number;
  supplierSubtotalCny: number;
  domesticDeliveryCny: number;
}>;

export const EMPTY_PRODUCT_SKU_SELECTION: ProductSkuSelectionState = {
  filters: {},
  quantitiesBySkuId: {},
};

export function setSelectionFilter(
  state: ProductSkuSelectionState,
  attributeName: string,
  value: string,
): ProductSkuSelectionState {
  return {
    ...state,
    filters: { ...state.filters, [attributeName]: value },
  };
}

export function setSkuSelectionQuantity<T extends SelectionSku>(
  skus: readonly T[],
  state: ProductSkuSelectionState,
  skuId: string,
  quantity: number,
): ProductSkuSelectionState {
  const sku = skus.find((candidate) => candidate.skuId === skuId);
  if (!sku || !Number.isSafeInteger(quantity)) return state;

  const quantitiesBySkuId = { ...state.quantitiesBySkuId };
  if (quantity <= 0) {
    delete quantitiesBySkuId[skuId];
  } else if (sku.availableQuantity !== undefined && sku.availableQuantity <= 0) {
    delete quantitiesBySkuId[skuId];
  } else {
    quantitiesBySkuId[skuId] = sku.availableQuantity === undefined
      ? quantity
      : Math.min(quantity, sku.availableQuantity);
  }

  return { ...state, quantitiesBySkuId };
}

export function clearProductSkuSelection(): ProductSkuSelectionState {
  return EMPTY_PRODUCT_SKU_SELECTION;
}

export function getSelectedSkuLines<T extends SelectionSku>(
  skus: readonly T[],
  state: ProductSkuSelectionState,
): SelectedSkuLine<T>[] {
  return skus.flatMap((sku) => {
    const quantity = state.quantitiesBySkuId[sku.skuId];
    if (!quantity || quantity < 1 || (sku.availableQuantity !== undefined && sku.availableQuantity <= 0)) return [];
    return [{ sku, quantity: sku.availableQuantity === undefined ? quantity : Math.min(quantity, sku.availableQuantity) }];
  });
}

/** Display-only supplier figures. Backend calculation remains authoritative. */
export function getSupplierSelectionSummary<T extends SelectionSku>(
  skus: readonly T[],
  state: ProductSkuSelectionState,
  domesticDeliveryCny: number,
): SupplierSelectionSummary {
  const lines = getSelectedSkuLines(skus, state);
  const subtotalCents = lines.reduce(
    (total, line) => total + Math.round(line.sku.priceCny * 100) * line.quantity,
    0,
  );
  return {
    selectedSkuCount: lines.length,
    selectedPieces: lines.reduce((total, line) => total + line.quantity, 0),
    supplierSubtotalCny: subtotalCents / 100,
    domesticDeliveryCny,
  };
}

/** The current estimate API supports one canonical SKU ID and quantity only. */
export function getSingleSkuEstimateSelection<T extends SelectionSku>(
  skus: readonly T[],
  state: ProductSkuSelectionState,
): Pick<SelectedSkuLine<T>, "sku" | "quantity"> | null {
  const lines = getSelectedSkuLines(skus, state);
  return lines.length === 1 ? lines[0] : null;
}
