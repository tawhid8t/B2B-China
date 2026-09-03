export type VariantSelectionSku = {
  skuId: string;
  attributes: Record<string, string>;
  availableQuantity?: number;
};

export type VariantOptionState = "available" | "unavailable" | "impossible";

const attributeTranslations: Record<string, string> = {
  "颜色": "Color", "颜色分类": "Color", "色号": "Color",
  "尺寸": "Size", "尺码": "Size", "规格": "Specification", "型号": "Model",
};

const colorTranslations: Array<[string, string]> = [
  ["暗夜红", "Dark red"], ["酒红", "Burgundy"], ["红色", "Red"], ["红", "Red"],
  ["粉色", "Pink"], ["粉", "Pink"], ["紫色", "Purple"], ["紫", "Purple"],
  ["黑色", "Black"], ["黑", "Black"], ["白色", "White"], ["白", "White"],
  ["蓝色", "Blue"], ["蓝", "Blue"], ["绿色", "Green"], ["绿", "Green"],
  ["黄色", "Yellow"], ["黄", "Yellow"], ["灰色", "Gray"], ["灰", "Gray"],
  ["棕色", "Brown"], ["棕", "Brown"], ["咖啡色", "Brown"], ["橙色", "Orange"], ["橙", "Orange"],
  ["米色", "Beige"], ["卡其", "Khaki"],
];

export function translateVariantAttributeName(value: string) { return attributeTranslations[value.trim()] ?? value; }
export function translateVariantValue(value: string) {
  const trimmed = value.trim();
  const exact = colorTranslations.find(([source]) => source === trimmed);
  if (exact) return exact[1];
  let translated = trimmed;
  for (const [source, target] of colorTranslations) {
    const index = translated.indexOf(source);
    if (index < 0) continue;
    const suffix = translated.slice(index + source.length);
    const separator = suffix && !/^[\s\-_/]/.test(suffix) ? " " : "";
    translated = `${translated.slice(0, index)}${target}${separator}${suffix}`;
  }
  return translated;
}
export function getDisplayVariantLabel(sku: VariantSelectionSku & { label?: string }) {
  const attributes = Object.entries(sku.attributes);
  return attributes.length ? attributes.map(([, value]) => translateVariantValue(value)).join(" / ") : translateVariantValue(sku.label ?? sku.skuId);
}
export function getVariantAttributeGroups(skus: VariantSelectionSku[]) {
  return skus.reduce<Record<string, string[]>>((groups, sku) => {
    Object.entries(sku.attributes).forEach(([name, value]) => { if (!groups[name]) groups[name] = []; if (!groups[name].includes(value)) groups[name].push(value); });
    return groups;
  }, {});
}
export function getVariantOptionState(skus: VariantSelectionSku[], selected: Record<string, string>, attributeName: string, candidate: string): VariantOptionState {
  const compatible = skus.filter((sku) => Object.entries(selected).every(([name, value]) => !value || name === attributeName || sku.attributes[name] === value) && sku.attributes[attributeName] === candidate);
  if (!compatible.length) return "impossible";
  return compatible.some((sku) => sku.availableQuantity === undefined || sku.availableQuantity > 0) ? "available" : "unavailable";
}
export function getMatchingVariantSkus<T extends VariantSelectionSku>(skus: T[], selected: Record<string, string>) { return skus.filter((sku) => Object.entries(selected).every(([name, value]) => !value || sku.attributes[name] === value)); }
export function getResolvedVariantSku<T extends VariantSelectionSku>(skus: T[], selected: Record<string, string>, attributeNames: string[]) {
  if (!attributeNames.length || attributeNames.some((name) => !selected[name])) return undefined;
  const matches = getMatchingVariantSkus(skus, selected);
  return matches.length === 1 ? matches[0] : undefined;
}
