import { EstimateBreakdown, EstimateInput } from "@/lib/types";

const DEFAULT_EXCHANGE_RATE_CNY_TO_BDT = 16.2;
const DEFAULT_CHINA_TO_GUANGZHOU_PER_KG_BDT = 35;
const DEFAULT_PROFIT_PERCENTAGE = 0.08;
const DEFAULT_CATEGORY_WEIGHT_KG: Record<string, number> = {
  apparel: 0.35,
  electronics: 0.55,
  accessories: 0.2,
  home: 0.8,
  default: 0.5
};
const DEFAULT_CATEGORY_SHIPPING_BDT_PER_KG: Record<string, number> = {
  apparel: 620,
  electronics: 780,
  accessories: 560,
  home: 690,
  default: 650
};

export function calculateEstimate(input: EstimateInput): EstimateBreakdown {
  const categoryKey = input.category.toLowerCase();
  const unitWeight = input.estimatedUnitWeightKg ?? DEFAULT_CATEGORY_WEIGHT_KG[categoryKey] ?? DEFAULT_CATEGORY_WEIGHT_KG.default;
  const totalWeight = roundMoney(unitWeight * input.quantity);
  const productSubtotalCny = roundMoney(input.unitPriceCny * input.quantity);
  const cnyCostBdt = roundMoney((productSubtotalCny + input.domesticDeliveryCny) * DEFAULT_EXCHANGE_RATE_CNY_TO_BDT);
  const categoryShippingBdt = roundMoney(totalWeight * (DEFAULT_CATEGORY_SHIPPING_BDT_PER_KG[categoryKey] ?? DEFAULT_CATEGORY_SHIPPING_BDT_PER_KG.default));
  const chinaToGuangzhouBdt = roundMoney(totalWeight * DEFAULT_CHINA_TO_GUANGZHOU_PER_KG_BDT);
  const profitBdt = roundMoney(cnyCostBdt * DEFAULT_PROFIT_PERCENTAGE);
  const totalBdt = roundMoney(cnyCostBdt + categoryShippingBdt + chinaToGuangzhouBdt + profitBdt);

  return {
    estimateId: `est_${Date.now()}`,
    unitPriceCny: input.unitPriceCny,
    quantity: input.quantity,
    productSubtotalCny,
    domesticDeliveryCny: input.domesticDeliveryCny,
    estimatedWeightKg: totalWeight,
    categoryShippingBdt,
    chinaToGuangzhouBdt,
    profitBdt,
    exchangeRateCnyToBdt: DEFAULT_EXCHANGE_RATE_CNY_TO_BDT,
    totalBdt,
    totalCnyEquivalent: roundMoney(totalBdt / DEFAULT_EXCHANGE_RATE_CNY_TO_BDT),
    validUntil: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  };
}

export function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
