import { apiError, apiSuccess } from "@/lib/api/response";
import { databaseErrorResponse } from "@/lib/api/database-error";
import { authorizeApiRequest } from "@/lib/auth/api";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  isPaymentProofMimeType,
  PAYMENT_PROOF_MAX_BYTES,
  paymentProofObjectPath,
} from "@/lib/payments/proof-upload";
import { createClientPaymentProof } from "@/services/client-wallet-service";
import { z } from "zod";

const proofSchema = z.object({
  amountBdt: z.coerce.number().positive().max(99_999_999.99),
  paidAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().trim().max(1000).optional(),
});

export async function POST(request: Request) {
  const authorization = await authorizeApiRequest(request, ["client"]);
  if (!authorization.authorized) return authorization.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("VALIDATION_ERROR", "Payment proof form data is invalid.", 400);
  }

  const body = proofSchema.safeParse({
    amountBdt: formData.get("amountBdt"),
    paidAt: formData.get("paidAt"),
    notes: formData.get("notes") || undefined,
  });
  if (!body.success) {
    return apiError("VALIDATION_ERROR", "Payment proof details are invalid.", 400, body.error.flatten());
  }

  if (body.data.paidAt > currentBangladeshDate()) {
    return apiError("VALIDATION_ERROR", "Payment date cannot be in the future.", 400);
  }

  const proof = formData.get("proof");
  if (!(proof instanceof File) || proof.size === 0) {
    return apiError("VALIDATION_ERROR", "A payment proof image or PDF is required.", 400);
  }
  if (proof.size > PAYMENT_PROOF_MAX_BYTES) {
    return apiError("VALIDATION_ERROR", "Payment proof must be 10 MB or smaller.", 400);
  }
  if (!isPaymentProofMimeType(proof.type)) {
    return apiError("VALIDATION_ERROR", "Payment proof must be JPG, PNG, WebP, or PDF.", 400);
  }

  const proofFilePath = paymentProofObjectPath(authorization.context.user.id, proof.type);
  const { error: uploadError } = await authorization.context.supabase.storage
    .from("payment-proofs")
    .upload(proofFilePath, await proof.arrayBuffer(), {
      contentType: proof.type,
      cacheControl: "0",
      upsert: false,
    });

  if (uploadError) {
    return apiError("INTERNAL_ERROR", "Payment proof file could not be stored.", 500);
  }

  try {
    const paymentProof = await createClientPaymentProof(authorization.context, {
      amountBdt: body.data.amountBdt,
      paidAt: body.data.paidAt,
      proofFilePath,
      notes: body.data.notes || null,
    });
    return apiSuccess(paymentProof, {}, 201);
  } catch (error) {
    await removeOrphanedProof(proofFilePath);
    return databaseErrorResponse(error, "INTERNAL_ERROR", "Payment proof could not be submitted.");
  }
}

function currentBangladeshDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

async function removeOrphanedProof(path: string) {
  try {
    await createSupabaseAdminClient().storage.from("payment-proofs").remove([path]);
  } catch {
    // The database response remains authoritative; cleanup can be retried operationally.
  }
}
