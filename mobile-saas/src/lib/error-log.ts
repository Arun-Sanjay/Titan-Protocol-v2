/**
 * Tiny error logger. M5 will route this through the observability adapters
 * (Sentry + PostHog) — until then it's a console wrapper so every call site
 * already exists when observability lands.
 */
export function logError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  if (context !== undefined) {
    console.error(`[${source}]`, error, context);
  } else {
    console.error(`[${source}]`, error);
  }
}
