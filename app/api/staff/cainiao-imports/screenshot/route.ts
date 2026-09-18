import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { RECEIVING_ROLES } from "@/lib/auth/roles";
import { manualCainiaoImportSchema, toManualCainiaoSyncParcel } from "@/lib/logistics/cainiao-import";
import {
  CAINIAO_SCREENSHOT_MAX_BYTES,
  cainiaoScreenshotObjectPath,
  isCainiaoScreenshotMimeType,
} from "@/lib/logistics/cainiao-screenshot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { z } from "zod";

const screenshotMetadataSchema = z.object({
  parcels: z.unknown(),
  ocrText: z.string().max(12_000).optional(),
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, RECEIVING_ROLES);
  if (!authorization.authorized) return authorization.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Screenshot import form data is invalid.", 400);
  }
  const screenshot = formData.get("screenshot");
  if (!(screenshot instanceof File) || screenshot.size === 0) {
    return apiError("VALIDATION_ERROR", "A Cainiao screenshot is required.", 400);
  }
  if (screenshot.size > CAINIAO_SCREENSHOT_MAX_BYTES || !isCainiaoScreenshotMimeType(screenshot.type)) {
    return apiError("VALIDATION_ERROR", "Screenshot must be a JPG, PNG, or WebP image of 8 MB or smaller.", 400);
  }

  const metadata = screenshotMetadataSchema.safeParse({
    parcels: parseJson(formData.get("parcels")),
    ocrText: formData.get("ocrText") || undefined,
  });
  if (!metadata.success) return apiError("VALIDATION_ERROR", "Screenshot review data is invalid.", 400, metadata.error.flatten());
  const reviewed = manualCainiaoImportSchema.safeParse({ parcels: metadata.data.parcels });
  if (!reviewed.success) return apiError("VALIDATION_ERROR", "Review every extracted parcel before confirming.", 400, reviewed.error.flatten());

  const admin = createSupabaseAdminClient();
  const screenshotPath = cainiaoScreenshotObjectPath(authorization.context.user.id, screenshot.type);
  const { error: uploadError } = await admin.storage.from("cainiao-imports").upload(screenshotPath, await screenshot.arrayBuffer(), {
    contentType: screenshot.type,
    cacheControl: "0",
    upsert: false,
  });
  if (uploadError) return apiError("INTERNAL_ERROR", "Screenshot evidence could not be stored.", 500);

  const syncParcels = reviewed.data.parcels.map((parcel) => ({
    ...toManualCainiaoSyncParcel(parcel),
    rawCapture: {
      source: "screenshot",
      reviewed: true,
      ocr_text: metadata.data.ocrText ?? "",
    },
  }));
  const { data: batch, error: batchError } = await admin
    .from("cainiao_import_batches")
    .insert({
      source: "screenshot",
      created_by: authorization.context.user.id,
      input_count: syncParcels.length,
      screenshot_path: screenshotPath,
      diagnostics: { contract_version: 1, ocr_text_length: metadata.data.ocrText?.length ?? 0 },
    })
    .select("id")
    .single();
  if (batchError || !batch) {
    await removeScreenshot(admin, screenshotPath);
    return databaseErrorResponse(batchError, "INTERNAL_ERROR", "Screenshot import could not be started.");
  }

  const { data, error } = await admin.rpc("sync_cainiao_parcels_for_profile", {
    p_profile_id: authorization.context.user.id,
    p_import_batch_id: batch.id,
    p_parcels: syncParcels,
    p_source: "screenshot",
  });
  if (error) {
    await admin.from("cainiao_import_batches").delete().eq("id", batch.id);
    await removeScreenshot(admin, screenshotPath);
    return databaseErrorResponse(error, "CONFLICT", "Reviewed Cainiao parcels could not be imported.");
  }

  const imported = Array.isArray(data) ? data : [];
  const matched = imported.filter((parcel) => Number(parcel.matched_order_item_count) > 0).length;
  const inserted = imported.filter((parcel) => parcel.inserted === true).length;
  return apiSuccess({
    importBatchId: batch.id,
    source: "screenshot",
    totals: { submitted: imported.length, inserted, refreshed: imported.length - inserted, matched, unmatched: imported.length - matched },
  }, {}, 201);
}

function parseJson(value: FormDataEntryValue | null) {
  if (typeof value !== "string") return null;
  try { return JSON.parse(value); } catch { return null; }
}

async function removeScreenshot(admin: ReturnType<typeof createSupabaseAdminClient>, path: string) {
  try { await admin.storage.from("cainiao-imports").remove([path]); } catch { /* Retain evidence if cleanup is unavailable. */ }
}
