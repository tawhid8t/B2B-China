import {
  EstimateCalculationError,
  calculateEstimate,
  type DecimalInput,
  type EstimateCalculationResult,
} from "./estimate-calculation-service.ts";

export type EstimateCalculationContext = {
  clientId: string;
  productId: string;
  skuId: string;
  unitPriceCny: DecimalInput;
  domesticDeliveryCny: DecimalInput;
  category: string;
  defaultWeightKg: DecimalInput | null;
  exchangeRate: {
    id: string;
    cnyToBdt: DecimalInput;
    source: string;
    effectiveOn: string;
  };
  categoryShippingRate: {
    id: string;
    bdtPerKg: DecimalInput;
  };
  profitRule: {
    id: string;
    name: string;
    category: string | null;
    percentage: DecimalInput | null;
    fixedBdt: DecimalInput | null;
  };
  chinaToGuangzhou: {
    id: string;
    bdtPerKg: DecimalInput;
  };
  validity: {
    id: string;
    minutes: number;
  };
};

export type PersistedEstimateInput = {
  clientId: string;
  productId: string;
  skuId: string;
  quantity: number;
  notes: string | null;
  status: "sent_to_client";
  calculation: EstimateCalculationResult;
};

export type PersistedEstimate = {
  id: string;
  status: "sent_to_client";
  validUntil: string;
};

export type EstimateRepository = {
  loadCalculationContext(input: {
    clientId: string;
    productId: string;
    skuId: string;
  }): Promise<EstimateCalculationContext>;
  persistEstimate(input: PersistedEstimateInput): Promise<PersistedEstimate>;
};

export type CreateEstimateInput = {
  clientId: string;
  productId: string;
  skuId: string;
  quantity: number;
  estimatedUnitWeightKg?: DecimalInput;
  notes?: string;
};

export class EstimateRequestError extends Error {
  readonly code: "NOT_FOUND" | "MANUAL_REVIEW_REQUIRED";

  constructor(
    code: "NOT_FOUND" | "MANUAL_REVIEW_REQUIRED",
    message: string,
  ) {
    super(message);
    this.name = "EstimateRequestError";
    this.code = code;
  }
}

export async function createEstimate(
  repository: EstimateRepository,
  input: CreateEstimateInput,
  options: { calculatedAt?: Date | string } = {},
) {
  const context = await repository.loadCalculationContext({
    clientId: input.clientId,
    productId: input.productId,
    skuId: input.skuId,
  });

  if (
    context.clientId !== input.clientId ||
    context.productId !== input.productId ||
    context.skuId !== input.skuId
  ) {
    throw new EstimateRequestError(
      "NOT_FOUND",
      "The requested client, product, or SKU could not be resolved.",
    );
  }

  const estimatedUnitWeightKg =
    input.estimatedUnitWeightKg ?? context.defaultWeightKg;
  if (estimatedUnitWeightKg === null) {
    throw new EstimateRequestError(
      "MANUAL_REVIEW_REQUIRED",
      "An estimated unit weight is required before this estimate can be calculated.",
    );
  }

  let calculation: EstimateCalculationResult;
  try {
    calculation = calculateEstimate(
      {
        productId: context.productId,
        skuId: context.skuId,
        category: context.category,
        unitPriceCny: context.unitPriceCny,
        quantity: input.quantity,
        domesticDeliveryCny: context.domesticDeliveryCny,
        estimatedUnitWeightKg,
        configuration: {
          exchangeRate: context.exchangeRate,
          categoryShippingRate: {
            id: context.categoryShippingRate.id,
            category: context.category,
            bdtPerKg: context.categoryShippingRate.bdtPerKg,
          },
          chinaToGuangzhouCost: {
            id: context.chinaToGuangzhou.id,
            mode: "per_kg",
            bdtPerKg: context.chinaToGuangzhou.bdtPerKg,
          },
          profitRule: context.profitRule,
          validity: context.validity,
        },
      },
      options,
    );
  } catch (error) {
    if (error instanceof EstimateCalculationError) {
      throw new EstimateRequestError("MANUAL_REVIEW_REQUIRED", error.message);
    }
    throw error;
  }

  const persisted = await repository.persistEstimate({
    clientId: context.clientId,
    productId: context.productId,
    skuId: context.skuId,
    quantity: input.quantity,
    notes: input.notes?.trim() || null,
    status: "sent_to_client",
    calculation,
  });

  return {
    estimateId: persisted.id,
    status: persisted.status,
    validUntil: persisted.validUntil,
    breakdown: calculation.breakdown,
  } as const;
}
