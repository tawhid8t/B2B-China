import { apiError, type ApiErrorCode } from "@/lib/api/response";

export class DatabaseOperationError extends Error {
  constructor(
    message: string,
    readonly code?: string,
    readonly details?: string,
    readonly hint?: string
  ) {
    super(message);
    this.name = "DatabaseOperationError";
  }
}

export function databaseErrorResponse(
  error: unknown,
  fallbackCode: ApiErrorCode = "INTERNAL_ERROR",
  fallbackMessage = "The database operation could not be completed."
) {
  if (!(error instanceof DatabaseOperationError)) {
    return apiError(fallbackCode, fallbackMessage, 500);
  }

  const normalizedMessage = error.message.toLowerCase();

  if (error.code === "42501") {
    return apiError("FORBIDDEN", error.message, 403);
  }

  if (error.code === "P0002") {
    return apiError("NOT_FOUND", error.message, 404);
  }

  if (normalizedMessage.includes("estimate has expired")) {
    return apiError("EXPIRED_ESTIMATE", error.message, 409);
  }

  if (error.code === "22023") {
    return apiError("VALIDATION_ERROR", error.message, 400);
  }

  if (error.code === "23505" || error.code === "23514" || error.code === "P0001") {
    return apiError("CONFLICT", error.message, 409, {
      details: error.details,
      hint: error.hint
    });
  }

  return apiError(fallbackCode, fallbackMessage, 500, {
    databaseCode: error.code,
    message: error.message
  });
}
