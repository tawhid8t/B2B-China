import { DatabaseOperationError } from "@/lib/api/database-error";
import { assertAuthorizedRole } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import type { AuthorizationContext } from "@/lib/auth/session";

export async function getClientProductStatementDetail(
  context: AuthorizationContext,
  productLinkId: string,
) {
  assertAuthorizedRole(context, CLIENT_OPERATION_ROLES);
  const { data, error } = await context.supabase.rpc(
    "get_client_product_statement_detail",
    { p_product_link_id: productLinkId },
  );
  if (error) {
    throw new DatabaseOperationError(
      error.message,
      error.code,
      error.details,
      error.hint,
    );
  }
  return data as Record<string, unknown> | null;
}
