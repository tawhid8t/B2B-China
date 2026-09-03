export type DecimalInput = string | number;

export type PersistedExchangeRate = {
  id: string;
  cnyToBdt: DecimalInput;
  source: string;
  effectiveOn: string;
};

export type PersistedCategoryShippingRate = {
  id: string;
  category: string;
  bdtPerKg: DecimalInput;
};

export type PersistedChinaToGuangzhouCost =
  | {
      id: string;
      mode: "per_kg";
      bdtPerKg: DecimalInput;
    }
  | {
      id: string;
      mode: "fixed";
      fixedBdt: DecimalInput;
    };

export type PersistedProfitRule = {
  id: string;
  name: string;
  category: string | null;
  percentage: DecimalInput | null;
  fixedBdt: DecimalInput | null;
};

export type PersistedEstimateValidity = {
  id: string;
  minutes: number;
};

export type EstimateCalculationInput = {
  productId: string;
  skuId: string;
  category: string;
  unitPriceCny: DecimalInput;
  quantity: number;
  domesticDeliveryCny: DecimalInput;
  estimatedUnitWeightKg: DecimalInput;
  configuration: {
    exchangeRate: PersistedExchangeRate;
    categoryShippingRate: PersistedCategoryShippingRate;
    chinaToGuangzhouCost: PersistedChinaToGuangzhouCost;
    profitRule: PersistedProfitRule;
    validity: PersistedEstimateValidity;
  };
};

export type EstimateCalculationOptions = {
  calculatedAt?: Date | string;
};

export type LogisticsEstimateLineInput = {
  skuId: string;
  unitPriceCny: DecimalInput;
  quantity: number;
  unitWeightKg: DecimalInput;
};

export type LogisticsEstimateInput = {
  productId: string;
  lines: LogisticsEstimateLineInput[];
  exchangeRate: DecimalInput;
  internationalShippingCategory: string;
  internationalShippingRateBdtPerKg: DecimalInput;
};

export type LogisticsEstimateBreakdown = Readonly<{
  productBaseCostCny: string;
  totalProductWeightKg: string;
  chinaDomesticShippingCny: string;
  chinaToGuangzhouCostCny: string;
  serviceChargeCny: string;
  totalCnyCost: string;
  exchangeRate: string;
  convertedCnyCostBdt: string;
  internationalShippingCategory: string;
  internationalShippingRateBdtPerKg: string;
  internationalShippingBdt: string;
  grandEstimatedTotalBdt: string;
}>;

export type EstimateCalculationResult = Readonly<{
  calculatedAt: string;
  validUntil: string;
  inputSnapshot: Readonly<{
    productId: string;
    skuId: string;
    category: string;
    unitPriceCny: string;
    quantity: number;
    domesticDeliveryCny: string;
    estimatedUnitWeightKg: string;
    exchangeRate: Readonly<{
      id: string;
      cnyToBdt: string;
      source: string;
      effectiveOn: string;
    }>;
    categoryShippingRate: Readonly<{
      id: string;
      category: string;
      bdtPerKg: string;
    }>;
    chinaToGuangzhouCost: Readonly<
      | { id: string; mode: "per_kg"; bdtPerKg: string }
      | { id: string; mode: "fixed"; fixedBdt: string }
    >;
    profitRule: Readonly<{
      id: string;
      name: string;
      category: string | null;
      percentage: string | null;
      fixedBdt: string | null;
    }>;
    validity: Readonly<{
      id: string;
      minutes: number;
    }>;
  }>;
  breakdown: Readonly<{
    unitPriceCny: string;
    quantity: number;
    productSubtotalCny: string;
    domesticDeliveryCny: string;
    productAndDomesticCny: string;
    exchangeRateCnyToBdt: string;
    productSubtotalBdt: string;
    estimatedUnitWeightKg: string;
    estimatedTotalWeightKg: string;
    categoryShippingRateBdtPerKg: string;
    categoryShippingBdt: string;
    chinaToGuangzhouMode: "per_kg" | "fixed";
    chinaToGuangzhouRateBdtPerKg: string | null;
    chinaToGuangzhouBdt: string;
    profitPercentage: string | null;
    profitFixedBdt: string | null;
    percentageProfitBdt: string;
    profitBdt: string;
    totalBdt: string;
  }>;
}>;

type FixedDecimal = {
  coefficient: bigint;
  scale: number;
};

const ZERO = parseDecimal("0", "zero");
const CHINA_DOMESTIC_SHIPPING_CNY_PER_KG = parseDecimal("4", "chinaDomesticShippingCnyPerKg");
const CHINA_TO_GUANGZHOU_COST_CNY_PER_KG = parseDecimal("4", "chinaToGuangzhouCostCnyPerKg");
const SERVICE_CHARGE_RATE = parseDecimal("0.06", "serviceChargeRate");

export class EstimateCalculationError extends Error {
  readonly code = "INVALID_ESTIMATE_INPUT";

  constructor(message: string) {
    super(message);
    this.name = "EstimateCalculationError";
  }
}

export class EstimateExpiredError extends Error {
  readonly code = "ESTIMATE_EXPIRED";
  readonly validUntil: string;

  constructor(validUntil: string) {
    super(`Estimate expired at ${validUntil}`);
    this.name = "EstimateExpiredError";
    this.validUntil = validUntil;
  }
}

export function calculateEstimate(
  input: EstimateCalculationInput,
  options: EstimateCalculationOptions = {},
): EstimateCalculationResult {
  validateIdentifier(input.productId, "productId");
  validateIdentifier(input.skuId, "skuId");
  validateIdentifier(input.category, "category");

  if (!Number.isSafeInteger(input.quantity) || input.quantity <= 0) {
    throw new EstimateCalculationError("quantity must be a positive safe integer");
  }

  const unitPriceCny = nonNegativeDecimal(input.unitPriceCny, "unitPriceCny");
  const domesticDeliveryCny = nonNegativeDecimal(
    input.domesticDeliveryCny,
    "domesticDeliveryCny",
  );
  const estimatedUnitWeightKg = positiveDecimal(
    input.estimatedUnitWeightKg,
    "estimatedUnitWeightKg",
  );
  const quantity = parseDecimal(String(input.quantity), "quantity");

  const exchangeRate = input.configuration.exchangeRate;
  validateIdentifier(exchangeRate.id, "configuration.exchangeRate.id");
  validateIdentifier(exchangeRate.source, "configuration.exchangeRate.source");
  validateIsoDate(exchangeRate.effectiveOn, "configuration.exchangeRate.effectiveOn");
  const cnyToBdt = positiveDecimal(
    exchangeRate.cnyToBdt,
    "configuration.exchangeRate.cnyToBdt",
  );

  const shippingRate = input.configuration.categoryShippingRate;
  validateIdentifier(shippingRate.id, "configuration.categoryShippingRate.id");
  if (shippingRate.category !== input.category) {
    throw new EstimateCalculationError(
      "configuration.categoryShippingRate.category must match the product category",
    );
  }
  const categoryShippingRateBdtPerKg = positiveDecimal(
    shippingRate.bdtPerKg,
    "configuration.categoryShippingRate.bdtPerKg",
  );

  const guangzhouCost = input.configuration.chinaToGuangzhouCost;
  validateIdentifier(guangzhouCost.id, "configuration.chinaToGuangzhouCost.id");
  const guangzhouRate =
    guangzhouCost.mode === "per_kg"
      ? nonNegativeDecimal(
          guangzhouCost.bdtPerKg,
          "configuration.chinaToGuangzhouCost.bdtPerKg",
        )
      : null;
  const guangzhouFixed =
    guangzhouCost.mode === "fixed"
      ? nonNegativeDecimal(
          guangzhouCost.fixedBdt,
          "configuration.chinaToGuangzhouCost.fixedBdt",
        )
      : null;

  const profitRule = input.configuration.profitRule;
  validateIdentifier(profitRule.id, "configuration.profitRule.id");
  validateIdentifier(profitRule.name, "configuration.profitRule.name");
  if (profitRule.category !== null && profitRule.category !== input.category) {
    throw new EstimateCalculationError(
      "configuration.profitRule.category must be null or match the product category",
    );
  }
  if (profitRule.percentage === null && profitRule.fixedBdt === null) {
    throw new EstimateCalculationError(
      "configuration.profitRule must include percentage, fixedBdt, or both",
    );
  }
  const profitPercentage =
    profitRule.percentage === null
      ? null
      : nonNegativeDecimal(
          profitRule.percentage,
          "configuration.profitRule.percentage",
        );
  const profitFixedBdt =
    profitRule.fixedBdt === null
      ? null
      : nonNegativeDecimal(
          profitRule.fixedBdt,
          "configuration.profitRule.fixedBdt",
        );

  const validity = input.configuration.validity;
  validateIdentifier(validity.id, "configuration.validity.id");
  if (!Number.isSafeInteger(validity.minutes) || validity.minutes <= 0) {
    throw new EstimateCalculationError(
      "configuration.validity.minutes must be a positive safe integer",
    );
  }

  const calculatedAt = parseTimestamp(options.calculatedAt ?? new Date(), "calculatedAt");
  const validUntil = new Date(calculatedAt.getTime() + validity.minutes * 60_000);
  if (!Number.isFinite(validUntil.getTime())) {
    throw new EstimateCalculationError("configuration.validity.minutes is too large");
  }

  const productSubtotalCny = quantize(multiply(unitPriceCny, quantity), 2);
  const productAndDomesticCny = quantize(add(productSubtotalCny, domesticDeliveryCny), 2);
  const productSubtotalBdt = quantize(multiply(productAndDomesticCny, cnyToBdt), 2);
  const estimatedTotalWeightKg = quantize(multiply(estimatedUnitWeightKg, quantity), 3);
  const categoryShippingBdt = quantize(
    multiply(estimatedTotalWeightKg, categoryShippingRateBdtPerKg),
    2,
  );
  const chinaToGuangzhouBdt =
    guangzhouCost.mode === "per_kg"
      ? quantize(multiply(estimatedTotalWeightKg, guangzhouRate!), 2)
      : quantize(guangzhouFixed!, 2);
  const percentageProfitBdt =
    profitPercentage === null
      ? ZERO
      : quantize(multiply(productSubtotalBdt, profitPercentage), 2);
  const profitBdt = quantize(add(percentageProfitBdt, profitFixedBdt ?? ZERO), 2);
  const totalBdt = quantize(
    add(add(add(productSubtotalBdt, categoryShippingBdt), chinaToGuangzhouBdt), profitBdt),
    2,
  );

  return deepFreeze({
    calculatedAt: calculatedAt.toISOString(),
    validUntil: validUntil.toISOString(),
    inputSnapshot: {
      productId: input.productId,
      skuId: input.skuId,
      category: input.category,
      unitPriceCny: format(unitPriceCny, 2),
      quantity: input.quantity,
      domesticDeliveryCny: format(domesticDeliveryCny, 2),
      estimatedUnitWeightKg: format(estimatedUnitWeightKg, 3),
      exchangeRate: {
        id: exchangeRate.id,
        cnyToBdt: format(cnyToBdt, 4),
        source: exchangeRate.source,
        effectiveOn: exchangeRate.effectiveOn,
      },
      categoryShippingRate: {
        id: shippingRate.id,
        category: shippingRate.category,
        bdtPerKg: format(categoryShippingRateBdtPerKg, 2),
      },
      chinaToGuangzhouCost:
        guangzhouCost.mode === "per_kg"
          ? {
              id: guangzhouCost.id,
              mode: "per_kg",
              bdtPerKg: format(guangzhouRate!, 2),
            }
          : {
              id: guangzhouCost.id,
              mode: "fixed",
              fixedBdt: format(guangzhouFixed!, 2),
            },
      profitRule: {
        id: profitRule.id,
        name: profitRule.name,
        category: profitRule.category,
        percentage: profitPercentage === null ? null : format(profitPercentage, 4),
        fixedBdt: profitFixedBdt === null ? null : format(profitFixedBdt, 2),
      },
      validity: {
        id: validity.id,
        minutes: validity.minutes,
      },
    },
    breakdown: {
      unitPriceCny: format(unitPriceCny, 2),
      quantity: input.quantity,
      productSubtotalCny: format(productSubtotalCny, 2),
      domesticDeliveryCny: format(domesticDeliveryCny, 2),
      productAndDomesticCny: format(productAndDomesticCny, 2),
      exchangeRateCnyToBdt: format(cnyToBdt, 4),
      productSubtotalBdt: format(productSubtotalBdt, 2),
      estimatedUnitWeightKg: format(estimatedUnitWeightKg, 3),
      estimatedTotalWeightKg: format(estimatedTotalWeightKg, 3),
      categoryShippingRateBdtPerKg: format(categoryShippingRateBdtPerKg, 2),
      categoryShippingBdt: format(categoryShippingBdt, 2),
      chinaToGuangzhouMode: guangzhouCost.mode,
      chinaToGuangzhouRateBdtPerKg:
        guangzhouRate === null ? null : format(guangzhouRate, 2),
      chinaToGuangzhouBdt: format(chinaToGuangzhouBdt, 2),
      profitPercentage: profitPercentage === null ? null : format(profitPercentage, 4),
      profitFixedBdt: profitFixedBdt === null ? null : format(profitFixedBdt, 2),
      percentageProfitBdt: format(percentageProfitBdt, 2),
      profitBdt: format(profitBdt, 2),
      totalBdt: format(totalBdt, 2),
    },
  });
}

export function calculateLogisticsEstimate(
  input: LogisticsEstimateInput,
): LogisticsEstimateBreakdown {
  validateIdentifier(input.productId, "productId");
  validateIdentifier(
    input.internationalShippingCategory,
    "internationalShippingCategory",
  );
  if (!Array.isArray(input.lines) || input.lines.length === 0) {
    throw new EstimateCalculationError("lines must include at least one SKU");
  }

  const exchangeRate = positiveDecimal(input.exchangeRate, "exchangeRate");
  const internationalShippingRateBdtPerKg = positiveDecimal(
    input.internationalShippingRateBdtPerKg,
    "internationalShippingRateBdtPerKg",
  );

  let productBaseCostCny = ZERO;
  let totalProductWeightKg = ZERO;

  for (const [index, line] of input.lines.entries()) {
    validateIdentifier(line.skuId, `lines[${index}].skuId`);
    if (!Number.isSafeInteger(line.quantity) || line.quantity <= 0) {
      throw new EstimateCalculationError(
        `lines[${index}].quantity must be a positive safe integer`,
      );
    }

    const quantity = parseDecimal(String(line.quantity), `lines[${index}].quantity`);
    const unitPriceCny = nonNegativeDecimal(
      line.unitPriceCny,
      `lines[${index}].unitPriceCny`,
    );
    const unitWeightKg = positiveDecimal(
      line.unitWeightKg,
      `lines[${index}].unitWeightKg`,
    );

    productBaseCostCny = add(productBaseCostCny, multiply(unitPriceCny, quantity));
    totalProductWeightKg = add(totalProductWeightKg, multiply(unitWeightKg, quantity));
  }

  const chinaDomesticShippingCny = multiply(
    totalProductWeightKg,
    CHINA_DOMESTIC_SHIPPING_CNY_PER_KG,
  );
  const chinaToGuangzhouCostCny = multiply(
    totalProductWeightKg,
    CHINA_TO_GUANGZHOU_COST_CNY_PER_KG,
  );
  const serviceChargeCny = multiply(productBaseCostCny, SERVICE_CHARGE_RATE);
  const totalCnyCost = add(
    add(add(productBaseCostCny, chinaDomesticShippingCny), chinaToGuangzhouCostCny),
    serviceChargeCny,
  );
  const convertedCnyCostBdt = ceil(multiply(totalCnyCost, exchangeRate));
  const internationalShippingBdt = multiply(
    totalProductWeightKg,
    internationalShippingRateBdtPerKg,
  );
  const grandEstimatedTotalBdt = add(
    convertedCnyCostBdt,
    internationalShippingBdt,
  );

  return deepFreeze({
    productBaseCostCny: format(productBaseCostCny, 2),
    totalProductWeightKg: format(totalProductWeightKg, 3),
    chinaDomesticShippingCny: format(chinaDomesticShippingCny, 2),
    chinaToGuangzhouCostCny: format(chinaToGuangzhouCostCny, 2),
    serviceChargeCny: format(serviceChargeCny, 2),
    totalCnyCost: format(totalCnyCost, 2),
    exchangeRate: format(exchangeRate, 4),
    convertedCnyCostBdt: format(convertedCnyCostBdt, 0),
    internationalShippingCategory: input.internationalShippingCategory,
    internationalShippingRateBdtPerKg: format(internationalShippingRateBdtPerKg, 2),
    internationalShippingBdt: format(internationalShippingBdt, 2),
    grandEstimatedTotalBdt: format(grandEstimatedTotalBdt, 2),
  });
}

export function isEstimateExpired(
  validUntil: Date | string,
  at: Date | string = new Date(),
): boolean {
  const expiry = parseTimestamp(validUntil, "validUntil");
  const comparison = parseTimestamp(at, "at");
  return comparison.getTime() >= expiry.getTime();
}

export function assertEstimateNotExpired(
  validUntil: Date | string,
  at: Date | string = new Date(),
): void {
  const expiry = parseTimestamp(validUntil, "validUntil");
  if (isEstimateExpired(expiry, at)) {
    throw new EstimateExpiredError(expiry.toISOString());
  }
}

function parseDecimal(value: DecimalInput, field: string): FixedDecimal {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new EstimateCalculationError(`${field} must be a finite decimal`);
  }

  const text = String(value).trim();
  const match = /^([+-]?)(\d+)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match) {
    throw new EstimateCalculationError(`${field} must be a valid decimal`);
  }

  const sign = match[1] === "-" ? BigInt(-1) : BigInt(1);
  const whole = match[2];
  const fraction = match[3] ?? "";
  const exponent = Number(match[4] ?? "0");
  if (!Number.isSafeInteger(exponent)) {
    throw new EstimateCalculationError(`${field} has an unsupported exponent`);
  }

  let coefficient = BigInt(`${whole}${fraction}`) * sign;
  let scale = fraction.length - exponent;
  if (scale < 0) {
    coefficient *= powerOfTen(-scale);
    scale = 0;
  }

  return normalize({ coefficient, scale });
}

function nonNegativeDecimal(value: DecimalInput, field: string): FixedDecimal {
  const parsed = parseDecimal(value, field);
  if (parsed.coefficient < BigInt(0)) {
    throw new EstimateCalculationError(`${field} must be non-negative`);
  }
  return parsed;
}

function positiveDecimal(value: DecimalInput, field: string): FixedDecimal {
  const parsed = parseDecimal(value, field);
  if (parsed.coefficient <= BigInt(0)) {
    throw new EstimateCalculationError(`${field} must be greater than zero`);
  }
  return parsed;
}

function add(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  const scale = Math.max(left.scale, right.scale);
  return normalize({
    coefficient:
      left.coefficient * powerOfTen(scale - left.scale) +
      right.coefficient * powerOfTen(scale - right.scale),
    scale,
  });
}

function multiply(left: FixedDecimal, right: FixedDecimal): FixedDecimal {
  return normalize({
    coefficient: left.coefficient * right.coefficient,
    scale: left.scale + right.scale,
  });
}

function quantize(value: FixedDecimal, scale: number): FixedDecimal {
  if (value.scale <= scale) {
    return {
      coefficient: value.coefficient * powerOfTen(scale - value.scale),
      scale,
    };
  }

  const divisor = powerOfTen(value.scale - scale);
  let quotient = value.coefficient / divisor;
  const remainder = value.coefficient % divisor;
  const absoluteRemainder = remainder < BigInt(0) ? -remainder : remainder;
  if (absoluteRemainder * BigInt(2) >= divisor) {
    quotient += value.coefficient < BigInt(0) ? BigInt(-1) : BigInt(1);
  }
  return { coefficient: quotient, scale };
}

function ceil(value: FixedDecimal): FixedDecimal {
  const normalized = normalize(value);
  if (normalized.scale === 0) return normalized;

  const divisor = powerOfTen(normalized.scale);
  let coefficient = normalized.coefficient / divisor;
  if (normalized.coefficient > BigInt(0) && normalized.coefficient % divisor !== BigInt(0)) {
    coefficient += BigInt(1);
  }
  return { coefficient, scale: 0 };
}

function format(value: FixedDecimal, scale: number): string {
  const rounded = quantize(value, scale);
  const negative = rounded.coefficient < BigInt(0);
  const digits = (negative ? -rounded.coefficient : rounded.coefficient).toString();
  if (scale === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(scale + 1, "0");
  const whole = padded.slice(0, -scale);
  const fraction = padded.slice(-scale);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function normalize(value: FixedDecimal): FixedDecimal {
  let { coefficient, scale } = value;
  while (scale > 0 && coefficient % BigInt(10) === BigInt(0)) {
    coefficient /= BigInt(10);
    scale -= 1;
  }
  return { coefficient, scale };
}

function powerOfTen(exponent: number): bigint {
  if (!Number.isSafeInteger(exponent) || exponent < 0 || exponent > 100) {
    throw new EstimateCalculationError("decimal precision is unsupported");
  }
  return BigInt(10) ** BigInt(exponent);
}

function validateIdentifier(value: string, field: string): void {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new EstimateCalculationError(`${field} is required`);
  }
}

function validateIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new EstimateCalculationError(`${field} must be an ISO date`);
  }
}

function parseTimestamp(value: Date | string, field: string): Date {
  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new EstimateCalculationError(`${field} must be a valid timestamp`);
  }
  return parsed;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const nested of Object.values(value)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}
