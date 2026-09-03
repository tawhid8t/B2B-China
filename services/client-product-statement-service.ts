import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import type { AuthorizationContext } from "@/lib/auth/session";
import type { OrderStatus } from "@/lib/domain/types";

export type ClientProductStatementFilters = {
  page: number;
  startDate?: string;
  endDate?: string;
  month?: string;
  category?: string;
  status?: OrderStatus;
};

export type ClientProductStatementResult = {
  rows: unknown[];
  total: number;
  chart: {
    orderedProducts: number;
    totalQuantity: number;
    totalWeightKg: number | null;
    totalBdt: number | null;
    categories: unknown[];
  };
};

export async function getClientProductStatement(
  context: AuthorizationContext,
  filters: ClientProductStatementFilters,
): Promise<ClientProductStatementResult> {
  assertAuthorizedRole(context, CLIENT_OPERATION_ROLES);
  const { data, error } = await context.supabase.rpc("get_client_product_statement", {
    p_page: filters.page,
    p_start_date: filters.startDate ?? null,
    p_end_date: filters.endDate ?? null,
    p_month: filters.month ? `${filters.month}-01` : null,
    p_category: filters.category ?? null,
    p_status: filters.status ?? null,
  });
  if (error) throw new DatabaseOperationError(error.message, error.code, error.details, error.hint);

  const result = data as ClientProductStatementResult | null;
  if (!result || !Array.isArray(result.rows) || !result.chart) {
    throw new DatabaseOperationError("Product statement returned an invalid result.");
  }
  return result;
}
