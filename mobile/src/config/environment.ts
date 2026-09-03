import { z } from "zod";

const runtimeConfigSchema = z.object({
  appVariant: z.enum(["development", "preview", "production"]),
  apiBaseUrl: z.string().url().optional(),
  supabaseUrl: z.string().url().optional(),
  supabasePublishableKey: z.string().min(1).optional()
}).superRefine((value, context) => {
  if (value.appVariant === "production" && !value.apiBaseUrl) {
    context.addIssue({ code: "custom", message: "EXPO_PUBLIC_API_BASE_URL is required in production." });
  }
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export type AuthRuntimeConfig = RuntimeConfig & {
  apiBaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
};

export function parseRuntimeConfig(input: unknown): RuntimeConfig {
  return runtimeConfigSchema.parse(input);
}

export function getRuntimeConfig(): RuntimeConfig {
  return parseRuntimeConfig({
    appVariant: process.env.EXPO_PUBLIC_APP_VARIANT ?? "development",
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL || undefined,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL || undefined,
    supabasePublishableKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined
  });
}

export function requireAuthRuntimeConfig(config: RuntimeConfig): AuthRuntimeConfig {
  const result = z.object({
    apiBaseUrl: z.string({ required_error: "EXPO_PUBLIC_API_BASE_URL is required." }).url("EXPO_PUBLIC_API_BASE_URL must be a valid URL."),
    supabaseUrl: z.string({ required_error: "EXPO_PUBLIC_SUPABASE_URL is required." }).url("EXPO_PUBLIC_SUPABASE_URL must be a valid URL."),
    supabasePublishableKey: z.string({ required_error: "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required." }).min(1, "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is required.")
  }).safeParse(config);
  if (!result.success) throw new Error(result.error.issues[0]?.message ?? "Mobile authentication is not configured.");
  return { ...config, ...result.data };
}
