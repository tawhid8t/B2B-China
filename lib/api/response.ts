import { NextResponse } from "next/server";

export type ApiMeta = Record<string, unknown>;

export type ApiSuccess<T> = {
  data: T;
  meta: ApiMeta;
};

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "EXPIRED_ESTIMATE"
  | "INSUFFICIENT_WALLET_BALANCE"
  | "PROVIDER_LOOKUP_FAILED"
  | "PROVIDER_SYNC_FAILED"
  | "COURIER_SYNC_FAILED"
  | "OCR_FAILED"
  | "MANUAL_REVIEW_REQUIRED"
  | "INTERNAL_ERROR";

export type ApiError = {
  error: {
    code: ApiErrorCode;
    message: string;
    details: unknown;
  };
};

export function apiSuccess<T>(data: T, meta: ApiMeta = {}, status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ data, meta }, { status });
}

export function apiError(code: ApiErrorCode, message: string, status: number, details: unknown = {}) {
  return NextResponse.json<ApiError>({ error: { code, message, details } }, { status });
}
