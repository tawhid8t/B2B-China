import { databaseErrorResponse } from "@/lib/api/database-error";
import { apiError, apiSuccess } from "@/lib/api/response";
import { authorizeApiRequest } from "@/lib/auth/api";
import { CLIENT_OPERATION_ROLES } from "@/lib/auth/roles";
import { ORDER_STATUSES } from "@/lib/domain/constants";
import { getClientProductStatement } from "@/services/client-product-statement-service";
import { z } from "zod";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const querySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  month: month.optional(),
  category: z.string().trim().min(1).max(120).optional(),
  status: z.enum(ORDER_STATUSES).optional(),
}).superRefine((value, context) => {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["endDate"], message: "End date must not be before start date." });
  }
});

export async function GET(request: Request) {
  const authorization = await authorizeApiRequest(request, CLIENT_OPERATION_ROLES);
  if (!authorization.authorized) return authorization.response;

  const url = new URL(request.url);
  const filters = querySchema.safeParse(Object.fromEntries(url.searchParams));
  if (!filters.success) {
    return apiError("VALIDATION_ERROR", "Invalid product statement filters.", 400, filters.error.flatten());
  }

  try {
    const statement = await getClientProductStatement(authorization.context, filters.data);
    return apiSuccess(statement.rows, {
      page: filters.data.page,
      pageSize: 30,
      total: statement.total,
      chart: statement.chart,
    });
  } catch (error) {
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Your product statement could not be loaded.");
  }
}
