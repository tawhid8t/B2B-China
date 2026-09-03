import { describe, expect, it } from "@jest/globals";

import { loginSchema } from "@/auth/login-schema";

describe("loginSchema", () => {
  it("requires a valid email and a password", () => {
    expect(loginSchema.safeParse({ email: "not-email", password: "" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: " client@example.com ", password: "secret" }).success).toBe(true);
  });
});
