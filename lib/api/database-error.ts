import { apiError, type ApiErrorCode } from "@/lib/api/response";

export class DatabaseOperationError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;

  constructor(
    message: string,
    code?: string,
    details?: string,
    hint?: string
  ) {
    super(message);
    this.name = "DatabaseOperationError";
    this.code = code;
    this.details = details;
    this.hint = hint;
  }
}

type DatabaseErrorLike = {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
};

function normalizeDatabaseError(error: unknown): DatabaseOperationError | null {
  if (error instanceof DatabaseOperationError) return error;
  if (!error || typeof error !== "object") return null;
  const value = error as DatabaseErrorLike;
  if (typeof value.message !== "string") return null;
  return new DatabaseOperationError(
    value.message,
    typeof value.code === "string" ? value.code : undefined,
    typeof value.details === "string" ? value.details : undefined,
    typeof value.hint === "string" ? value.hint : undefined,
  );
}

export function databaseErrorResponse(
  error: unknown,
  fallbackCode: ApiErrorCode = "INTERNAL_ERROR",
  fallbackMessage = "The database operation could not be completed."
) {
  const databaseError = normalizeDatabaseError(error);
  if (!databaseError) {
    return apiError(fallbackCode, fallbackMessage, 500);
  }

  const normalizedMessage = databaseError.message.toLowerCase();

  if (databaseError.code === "42501") {
    return apiError("FORBIDDEN", databaseError.message, 403);
  }

  if (databaseError.code === "P0002") {
    return apiError("NOT_FOUND", databaseError.message, 404);
  }

  if (normalizedMessage.includes("estimate has expired")) {
    return apiError("EXPIRED_ESTIMATE", databaseError.message, 409);
  }

  if (databaseError.code === "22023") {
    return apiError("VALIDATION_ERROR", databaseError.message, 400);
  }

  if (databaseError.code === "23505" || databaseError.code === "23514" || databaseError.code === "P0001") {
    return apiError("CONFLICT", databaseError.message, 409, {
      details: databaseError.details,
      hint: databaseError.hint
    });
  }

  return apiError(fallbackCode, fallbackMessage, 500, {
    databaseCode: databaseError.code,
    message: databaseError.message
  });
}
