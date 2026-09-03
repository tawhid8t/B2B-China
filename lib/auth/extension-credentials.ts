import { createHash, randomBytes } from "node:crypto";

const tokenPrefix = "bcx_";

export function createExtensionCredentialToken() {
  return `${tokenPrefix}${randomBytes(32).toString("base64url")}`;
}

export function hashExtensionCredentialToken(token: string) {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function parseBearerCredential(request: Request) {
  const match = /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization")?.trim() ?? "");
  return match?.[1]?.trim() || null;
}
