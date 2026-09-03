const protectedPathPattern = /^\/(?:client|staff|admin)(?:\/|$)/;

export function safePostLoginPath(candidate: string | null | undefined) {
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return undefined;
  }

  return protectedPathPattern.test(candidate) ? candidate : undefined;
}
