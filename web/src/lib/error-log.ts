/**
 * Error logger. Tags errors with a source identifier and structured
 * context, then routes them through `lib/observability` (Sentry if a
 * DSN is configured; console always).
 *
 * Usage:
 *   import { logError } from "@/lib/error-log";
 *   logError("backup.upsert.failed", err, { table: "tasks" });
 */
import { captureException } from "./observability";

export function logError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  const ctx: Record<string, unknown> = { source, ...(context ?? {}) };
  captureException(error, ctx);
}
