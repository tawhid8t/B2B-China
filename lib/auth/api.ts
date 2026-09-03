import { apiError } from "@/lib/api/response";
import { DatabaseOperationError } from "@/lib/api/database-error";
import { isRoleAllowed } from "@/lib/auth/roles";
import { resolveAuthorizationContext, type AuthorizationContext } from "@/lib/auth/session";
import type { UserRole } from "@/lib/domain/types";

export type ApiAuthorizationResult =
  | { authorized: true; context: AuthorizationContext }
  | { authorized: false; response: ReturnType<typeof apiError> };

export async function authorizeApiRequest(request: Request, allowedRoles: readonly UserRole[]): Promise<ApiAuthorizationResult> {
  const resolution = await resolveAuthorizationContext(request);
  if (resolution.status === "unauthenticated") {
    return { authorized: false, response: apiError("UNAUTHORIZED", "Authentication is required.", 401) };
  }
  if (resolution.status === "forbidden" || !isRoleAllowed(resolution.context.role, allowedRoles)) {
    return { authorized: false, response: apiError("FORBIDDEN", "You do not have permission to perform this action.", 403) };
  }
  return { authorized: true, context: resolution.context };
}

export class ForbiddenOperationError extends DatabaseOperationError {
  constructor() {
    super("The authenticated role cannot perform this server operation.", "42501");
    this.name = "ForbiddenOperationError";
  }
}

export function assertAuthorizedRole(context: AuthorizationContext, allowedRoles: readonly UserRole[]) {
  if (!isRoleAllowed(context.role, allowedRoles)) throw new ForbiddenOperationError();
}
