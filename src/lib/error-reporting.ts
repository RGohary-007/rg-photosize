export function reportError(error: unknown, context: Record<string, unknown> = {}) {
  console.error("[app-error]", error, context);
}
