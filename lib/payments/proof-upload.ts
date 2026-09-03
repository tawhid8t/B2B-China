import { randomUUID } from "node:crypto";

export const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;

export const PAYMENT_PROOF_MIME_EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
} as const;

export type PaymentProofMimeType = keyof typeof PAYMENT_PROOF_MIME_EXTENSIONS;

export function isPaymentProofMimeType(value: string): value is PaymentProofMimeType {
  return value in PAYMENT_PROOF_MIME_EXTENSIONS;
}

export function paymentProofObjectPath(profileId: string, mimeType: PaymentProofMimeType) {
  return `${profileId}/${randomUUID()}.${PAYMENT_PROOF_MIME_EXTENSIONS[mimeType]}`;
}
