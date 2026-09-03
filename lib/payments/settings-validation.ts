import { z } from "zod";

const optionalText = z.string().trim().max(1000).nullable().optional().transform((value) => value || null);
export const paymentInstructionSchema = z.object({
  method: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  accountName: optionalText,
  accountIdentifier: optionalText,
  instructions: optionalText,
  active: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(10_000).default(0),
}).refine((value) => Boolean(value.accountIdentifier || value.instructions), {
  message: "Account identifier or instructions are required.",
  path: ["accountIdentifier"],
});

export const paymentInstructionPatchSchema = z.object({
  method: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(120).optional(),
  accountName: optionalText,
  accountIdentifier: optionalText,
  instructions: optionalText,
  active: z.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).max(10_000).optional(),
}).refine((value) => Object.keys(value).length > 0);
