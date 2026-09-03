import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import type { AuthorizationContext } from "@/lib/auth/session";

export type ClientOrderCardsResult = { orders: unknown[] };

export async function getClientOrderCards(context: AuthorizationContext): Promise<ClientOrderCardsResult> {
  assertAuthorizedRole(context, CLIENT_OPERATION_ROLES);
  const { data, error } = await context.supabase.rpc("get_client_order_cards");
  if (error) throw new DatabaseOperationError(error.message, error.code, error.details, error.hint);
  const result = data as ClientOrderCardsResult | null;
  if (!result || !Array.isArray(result.orders)) throw new DatabaseOperationError("Order cards returned an invalid result.");
  return result;
}
