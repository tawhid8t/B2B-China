import { describe, expect, it } from "@jest/globals";
import { parseRuntimeConfig, requireAuthRuntimeConfig } from "@/config/environment";

describe("parseRuntimeConfig", () => {
  it("accepts development without an API endpoint", () => {
    expect(parseRuntimeConfig({ appVariant: "development" }).appVariant).toBe("development");
  });

  it("requires an API endpoint in production", () => {
    expect(() => parseRuntimeConfig({ appVariant: "production" })).toThrow("EXPO_PUBLIC_API_BASE_URL");
  });

  it("requires every public auth endpoint before starting authentication", () => {
    const config = parseRuntimeConfig({ appVariant: "development", apiBaseUrl: "https://example.com/api/" });
    expect(() => requireAuthRuntimeConfig(config)).toThrow("EXPO_PUBLIC_SUPABASE_URL");
    expect(requireAuthRuntimeConfig({
      ...config,
      supabaseUrl: "https://example.supabase.co",
      supabasePublishableKey: "publishable-key"
    }).supabasePublishableKey).toBe("publishable-key");
  });
});
