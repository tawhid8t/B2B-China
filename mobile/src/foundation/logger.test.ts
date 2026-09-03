import { describe, expect, it } from "@jest/globals";
import { redactLogContext } from "@/foundation/logger";

describe("redactLogContext", () => {
  it("removes sensitive values from diagnostic context", () => {
    expect(redactLogContext({ token: "secret", nested: { balance: 42, route: "/health" } })).toEqual({
      token: "[REDACTED]", nested: { balance: "[REDACTED]", route: "/health" }
    });
  });
});
