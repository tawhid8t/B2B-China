import type { ClientBootstrapData } from "@bridgecart/contracts";
import { z } from "zod";

export const clientBootstrapSchema = z.object({
  profile: z.object({
    id: z.string().uuid(),
    email: z.string().email().nullable(),
    fullName: z.string().min(1),
    role: z.literal("client"),
    status: z.literal("active")
  }),
  client: z.object({
    id: z.string().uuid(),
    businessName: z.string().min(1)
  })
}) satisfies z.ZodType<ClientBootstrapData>;

export type { ClientBootstrapData };
