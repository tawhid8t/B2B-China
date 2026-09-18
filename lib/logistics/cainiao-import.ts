import { z } from "zod";

export const MANUAL_CAINIAO_STATUSES = [
  "ready_for_pickup",
  "arriving_soon",
  "in_transit",
  "returned",
] as const;

const optionalText = (max: number) =>
  z.string().trim().min(1).max(max).optional();

export const manualCainiaoParcelSchema = z
  .object({
    trackingNumber: z.string().trim().min(6).max(128),
    pickupCode: z.string().trim().min(1).max(64),
    carrier: optionalText(100),
    pickupStation: optionalText(240),
    status: z.enum(MANUAL_CAINIAO_STATUSES).default("ready_for_pickup"),
    arrivedAt: z.string().datetime({ offset: true }).optional(),
    expectedArrivalAt: z.string().datetime({ offset: true }).optional(),
    lastTrackingUpdateAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .superRefine((parcel, context) => {
    if (!/^[A-Z0-9-]{6,64}$/.test(normalizeCainiaoTrackingNumber(parcel.trackingNumber))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["trackingNumber"],
        message: "Tracking number must contain 6–64 letters, numbers, or hyphens.",
      });
    }
  });

export const manualCainiaoImportSchema = z
  .object({
    parcels: z.array(manualCainiaoParcelSchema).min(1).max(200),
  })
  .strict()
  .superRefine((payload, context) => {
    const seen = new Set<string>();
    payload.parcels.forEach((parcel, index) => {
      const trackingNumber = normalizeCainiaoTrackingNumber(parcel.trackingNumber);
      if (seen.has(trackingNumber)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["parcels", index, "trackingNumber"],
          message: "Each tracking number may appear only once in an import.",
        });
      }
      seen.add(trackingNumber);
    });
  });

export type ManualCainiaoImport = z.infer<typeof manualCainiaoImportSchema>;
export type ManualCainiaoParcel = z.infer<typeof manualCainiaoParcelSchema>;

export function normalizeCainiaoTrackingNumber(value: string) {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export function toManualCainiaoSyncParcel(parcel: ManualCainiaoParcel) {
  const trackingNumber = normalizeCainiaoTrackingNumber(parcel.trackingNumber);
  return {
    trackingNumber,
    pickupCode: parcel.pickupCode.trim(),
    carrier: parcel.carrier?.trim(),
    pickupStation: parcel.pickupStation?.trim(),
    status: parcel.status,
    arrivedAt: parcel.arrivedAt,
    expectedArrivalAt: parcel.expectedArrivalAt,
    lastTrackingUpdateAt: parcel.lastTrackingUpdateAt,
    rawCapture: {
      source: "manual",
      entered_fields: [
        "trackingNumber",
        "pickupCode",
        ...(parcel.carrier ? ["carrier"] : []),
        ...(parcel.pickupStation ? ["pickupStation"] : []),
        "status",
      ],
    },
  };
}
