const redactedKeys = /token|authorization|password|secret|credential|proof|financial|amount|balance/i;

export function redactLogContext(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactLogContext);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactedKeys.test(key) ? "[REDACTED]" : redactLogContext(item)]));
  }
  return value;
}

export const logger = {
  info: (event: string, context?: unknown) => console.info(`[BridgeCart] ${event}`, redactLogContext(context)),
  warn: (event: string, context?: unknown) => console.warn(`[BridgeCart] ${event}`, redactLogContext(context)),
  error: (event: string, context?: unknown) => console.error(`[BridgeCart] ${event}`, redactLogContext(context))
};
