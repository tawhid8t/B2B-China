import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import type { AuthorizationContext } from "@/lib/auth/session";

type RecordActualDetailsInput = {
  orderItemId: string;
  productAmountCny?: number;
  localDeliveryCny?: number;
  weightKg?: number;
  adminNote?: string;
  reason: string;
};

type ActualDetailRow = {
  actual_detail_id: string;
  order_item_id: string;
  product_amount_cny: number | string | null;
  local_delivery_cny: number | string | null;
  weight_kg: number | string | null;
  admin_note: string | null;
  recorded_at: string;
};

export async function recordOrderActualDetails(
  context: AuthorizationContext,
  input: RecordActualDetailsInput,
) {
  assertAuthorizedRole(context, ADMIN_ROLES);
  const { data, error } = await context.supabase.rpc("record_order_actual_details", {
    p_order_item_id: input.orderItemId,
    p_product_amount_cny: input.productAmountCny ?? null,
    p_local_delivery_cny: input.localDeliveryCny ?? null,
    p_weight_kg: input.weightKg ?? null,
    p_admin_note: input.adminNote ?? null,
    p_reason: input.reason,
  });
  if (error) throw new DatabaseOperationError(error.message, error.code, error.details, error.hint);

  const row = (Array.isArray(data) ? data[0] : data) as ActualDetailRow | null;
  if (!row) throw new DatabaseOperationError("Actual detail recording returned no result.");
  return {
    actualDetailId: row.actual_detail_id,
    orderItemId: row.order_item_id,
    productAmountCny: row.product_amount_cny === null ? null : Number(row.product_amount_cny),
    localDeliveryCny: row.local_delivery_cny === null ? null : Number(row.local_delivery_cny),
    weightKg: row.weight_kg === null ? null : Number(row.weight_kg),
    adminNote: row.admin_note,
    recordedAt: row.recorded_at,
  };
}
