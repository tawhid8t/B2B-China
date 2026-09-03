import { z } from "zod";

export const apiErrorEnvelopeSchema = z.object({ error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() }) });

export function apiSuccessEnvelopeSchema<TSchema extends z.ZodTypeAny>(dataSchema: TSchema) {
  return z.object({ data: dataSchema, meta: z.record(z.string(), z.unknown()).optional() });
}

export class ApiClientError extends Error {
  constructor(readonly details: { code: string; message: string; status: number; details?: unknown }) {
    super(details.message);
    this.name = "ApiClientError";
  }
}

export function decodeApiPayload<TSchema extends z.ZodTypeAny>(payload: unknown, status: number, dataSchema: TSchema): z.infer<TSchema> {
  if (status >= 200 && status < 300) {
    const result = apiSuccessEnvelopeSchema(dataSchema).safeParse(payload);
    if (result.success) return result.data.data;
    throw new ApiClientError({ code: "CONTRACT_DECODE_FAILED", message: "The server returned an invalid success envelope.", status });
  }
  const result = apiErrorEnvelopeSchema.safeParse(payload);
  if (result.success) throw new ApiClientError({ status, ...result.data.error });
  throw new ApiClientError({ code: "CONTRACT_DECODE_FAILED", message: "The server returned an invalid error envelope.", status });
}

/** Foundation transport only. No business endpoint is invoked in Phase 5. */
export class ApiClient {
  constructor(private readonly baseUrl: string) {}

  async request<TSchema extends z.ZodTypeAny>(path: string, dataSchema: TSchema, init?: RequestInit): Promise<z.infer<TSchema>> {
    const normalizedBaseUrl = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
    let response: Response;
    try {
      response = await fetch(new URL(path.replace(/^\//, ""), normalizedBaseUrl), {
        ...init,
        headers: { Accept: "application/json", ...init?.headers }
      });
    } catch (error) {
      throw new ApiClientError({
        code: error instanceof Error && error.name === "AbortError" ? "REQUEST_TIMEOUT" : "NETWORK_ERROR",
        message: error instanceof Error && error.name === "AbortError"
          ? "The request timed out."
          : "The server could not be reached.",
        status: 0,
        details: error
      });
    }
    const payload: unknown = await response.json().catch(() => undefined);
    return decodeApiPayload(payload, response.status, dataSchema);
  }
}
