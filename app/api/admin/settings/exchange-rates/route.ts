import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { OWNER_ROLES } from "@/lib/auth/roles";
import { createExchangeRate, getPaymentSettings } from "@/services/admin-payment-service";
import { z } from "zod";

const schema = z.object({
  cnyToBdt: z.coerce.number().positive().max(99_999.9999),
  effectiveOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  source: z.string().trim().min(1).max(100).default("admin_default"),
});

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, OWNER_ROLES);
  if (!authorization.authorized) return authorization.response;
  try { return apiSuccess((await getPaymentSettings(authorization.context)).rates); }
  catch (error) { return databaseErrorResponse(error); }
}

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, OWNER_ROLES);
  if (!authorization.authorized) return authorization.response;
  let json: unknown;
  try { json = await request.json(); } catch { return apiError("VALIDATION_ERROR", "Exchange-rate payload is invalid.", 400); }
  const body = schema.safeParse(json);
  if (!body.success) return apiError("VALIDATION_ERROR", "A valid rate and effective date are required.", 400, body.error.flatten());
  try { return apiSuccess(await createExchangeRate(authorization.context, body.data), {}, 201); }
  catch (error) { return databaseErrorResponse(error); }
}
