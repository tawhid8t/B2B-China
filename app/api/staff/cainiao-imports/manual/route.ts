import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { RECEIVING_ROLES } from "@/lib/auth/roles";
import {
  manualCainiaoImportSchema,
  toManualCainiaoSyncParcel,
} from "@/lib/logistics/cainiao-import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, RECEIVING_ROLES);
  if (!authorization.authorized) return authorization.response;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "A JSON request body is required.", 400);
  }

  const parsed = manualCainiaoImportSchema.safeParse(json);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "Manual Cainiao import data is invalid.", 400, parsed.error.flatten());
  }

  const admin = createSupabaseAdminClient();
  const syncParcels = parsed.data.parcels.map(toManualCainiaoSyncParcel);
  const { data: batch, error: batchError } = await admin
    .from("cainiao_import_batches")
    .insert({
      source: "manual",
      created_by: authorization.context.user.id,
      input_count: syncParcels.length,
      diagnostics: { contract_version: 1 },
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return databaseErrorResponse(batchError, "INTERNAL_ERROR", "Cainiao import could not be started.");
  }

  const { data, error } = await admin.rpc("sync_cainiao_parcels_for_profile", {
    p_profile_id: authorization.context.user.id,
    p_import_batch_id: batch.id,
    p_parcels: syncParcels,
    p_source: "manual",
  });

  if (error) {
    await removeEmptyImportBatch(admin, batch.id);
    return databaseErrorResponse(error, "CONFLICT", "Cainiao parcels could not be imported.");
  }

  const imported = Array.isArray(data) ? data : [];
  const matched = imported.filter((parcel) => Number(parcel.matched_order_item_count) > 0).length;
  const inserted = imported.filter((parcel) => parcel.inserted === true).length;

  return apiSuccess(
    {
      importBatchId: batch.id,
      source: "manual",
      totals: {
        submitted: imported.length,
        inserted,
        refreshed: imported.length - inserted,
        matched,
        unmatched: imported.length - matched,
      },
      parcels: imported.map((parcel) => ({
        trackingNumber: parcel.tracking_number,
        parcelId: parcel.parcel_id,
        status: parcel.parcel_status,
        matchedOrderItemCount: parcel.matched_order_item_count,
        outcome: parcel.inserted ? "imported" : "updated",
      })),
    },
    {},
    201,
  );
}

async function removeEmptyImportBatch(
  admin: ReturnType<typeof createSupabaseAdminClient>,
  batchId: string,
) {
  try {
    await admin.from("cainiao_import_batches").delete().eq("id", batchId);
  } catch {
    // A completed RPC references its batch and prevents deletion. Retaining it
    // is safer than deleting evidence after an uncertain network failure.
  }
}
