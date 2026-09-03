import { describe, expect, it } from "@jest/globals";
import { z } from "zod";

import { ApiClientError, decodeApiPayload } from "@/foundation/api";

describe("decodeApiPayload", () => {
  it("returns a validated success payload", () => {
    expect(decodeApiPayload({ data: { version: "v1" } }, 200, z.object({ version: z.string() }))).toEqual({ version: "v1" });
  });

  it("normalizes a documented API error envelope", () => {
    expect(() => decodeApiPayload({ error: { code: "FORBIDDEN", message: "Denied" } }, 403, z.unknown())).toThrow(ApiClientError);
  });
});
