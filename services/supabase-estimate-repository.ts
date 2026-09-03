import type { SupabaseClient } from "@supabase/supabase-js";
import { DatabaseOperationError } from "@/lib/api/database-error";
import {
  EstimateRequestError,
  type EstimateCalculationContext,
  type EstimateRepository,
  type PersistedEstimateInput,
} from "@/services/estimate-service";

type DatabaseErrorShape = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

type CalculationContextRow = {
  client_id: string;
  product_link_id: string;
  product_sku_id: string;
  unit_price_cny: number | string;
  domestic_delivery_cny: number | string;
  category: string;
  default_weight_kg: number | string | null;
  exchange_rate_id: string;
  exchange_rate_cny_to_bdt: number | string;
  exchange_rate_source: string;
  exchange_rate_effective_on: string;
  shipping_rate_id: string;
  shipping_rate_bdt_per_kg: number | string;
  profit_rule_id: string;
  profit_rule_name: string;
  profit_rule_category: string | null;
  profit_rule_percentage: number | string | null;
  profit_rule_fixed_bdt: number | string | null;
  guangzhou_setting_id: string;
  guangzhou_bdt_per_kg: number | string;
  validity_setting_id: string;
  validity_minutes: number;
};

type PersistedEstimateRow = {
  id: string;
  status: "sent_to_client";
  valid_until: string;
};

export function createSupabaseEstimateRepository(
  supabase: SupabaseClient,
): EstimateRepository {
  return {
    async loadCalculationContext(input) {
      const { data, error } = await supabase
        .rpc("get_estimate_calculation_context", {
          p_client_id: input.clientId,
          p_product_link_id: input.productId,
          p_product_sku_id: input.skuId,
        })
        .single();

      if (error) throwContextError(error);
      if (!data) {
        throw new EstimateRequestError(
          "NOT_FOUND",
          "The requested estimate inputs could not be found.",
        );
      }

      return mapCalculationContext(data as CalculationContextRow);
    },

    async persistEstimate(input) {
      const record = mapEstimateRecord(input);
      const { data, error } = await supabase
        .from("estimates")
        .insert(record)
        .select("id, status, valid_until")
        .single();

      if (error) throwDatabaseError(error);
      if (!data) {
        throw new DatabaseOperationError("Estimate creation returned no result.");
      }

      const row = data as PersistedEstimateRow;
      return {
        id: row.id,
        status: row.status,
        validUntil: row.valid_until,
      };
    },
  };
}

function mapCalculationContext(row: CalculationContextRow): EstimateCalculationContext {
  return {
    clientId: row.client_id,
    productId: row.product_link_id,
    skuId: row.product_sku_id,
    unitPriceCny: row.unit_price_cny,
    domesticDeliveryCny: row.domestic_delivery_cny,
    category: row.category,
    defaultWeightKg: row.default_weight_kg,
    exchangeRate: {
      id: row.exchange_rate_id,
      cnyToBdt: row.exchange_rate_cny_to_bdt,
      source: row.exchange_rate_source,
      effectiveOn: row.exchange_rate_effective_on,
    },
    categoryShippingRate: {
      id: row.shipping_rate_id,
      bdtPerKg: row.shipping_rate_bdt_per_kg,
    },
    profitRule: {
      id: row.profit_rule_id,
      name: row.profit_rule_name,
      category: row.profit_rule_category,
      percentage: row.profit_rule_percentage,
      fixedBdt: row.profit_rule_fixed_bdt,
    },
    chinaToGuangzhou: {
      id: row.guangzhou_setting_id,
      bdtPerKg: row.guangzhou_bdt_per_kg,
    },
    validity: {
      id: row.validity_setting_id,
      minutes: row.validity_minutes,
    },
  };
}

function mapEstimateRecord(input: PersistedEstimateInput) {
  const { calculation } = input;
  return {
    client_id: input.clientId,
    product_link_id: input.productId,
    product_sku_id: input.skuId,
    sku_id: input.skuId,
    quantity: input.quantity,
    unit_price_cny: calculation.breakdown.unitPriceCny,
    domestic_delivery_cny: calculation.breakdown.domesticDeliveryCny,
    estimated_unit_weight_kg: calculation.breakdown.estimatedUnitWeightKg,
    estimated_total_weight_kg: calculation.breakdown.estimatedTotalWeightKg,
    exchange_rate_cny_to_bdt: calculation.breakdown.exchangeRateCnyToBdt,
    category_shipping_bdt: calculation.breakdown.categoryShippingBdt,
    china_to_guangzhou_bdt: calculation.breakdown.chinaToGuangzhouBdt,
    profit_bdt: calculation.breakdown.profitBdt,
    total_bdt: calculation.breakdown.totalBdt,
    breakdown: {
      version: 1,
      calculatedAt: calculation.calculatedAt,
      inputs: calculation.inputSnapshot,
      costs: calculation.breakdown,
    },
    notes: input.notes,
    status: input.status,
    valid_until: calculation.validUntil,
  };
}

function throwContextError(error: DatabaseErrorShape): never {
  if (
    error.code === "P0001" &&
    (
      error.message.toLowerCase().includes("configuration") ||
      error.message.toLowerCase().includes("manual review")
    )
  ) {
    throw new EstimateRequestError("MANUAL_REVIEW_REQUIRED", error.message);
  }
  if (error.code === "P0002") {
    throw new EstimateRequestError("NOT_FOUND", error.message);
  }
  throwDatabaseError(error);
}

function throwDatabaseError(error: DatabaseErrorShape): never {
  throw new DatabaseOperationError(
    error.message,
    error.code,
    error.details,
    error.hint,
  );
}
