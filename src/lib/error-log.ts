/**
 * Phase 2.2B: In-memory error ring buffer.
 *
 * Problem: src/db/storage.ts historically had bare `catch {}` blocks on
 * JSON parse and serialize failures. Combined with no telemetry, this
 * meant MMKV corruption or serialization bugs were completely invisible —
 * users saw mysterious data loss and the dev had zero debug info.
 *
 * This module provides a centralized error log:
 * - Fixed-size ring buffer (last N errors kept in memory)
 * - Subscribable so a debug screen can show recent errors
 * - In Phase 4.4 this will be upgraded to forward errors to Sentry
 *   (keep the ring buffer for dev builds / hidden debug screen)
 *
 * Usage:
 *   import { logError } from "@/lib/error-log";
 *   try { ... } catch (e) {
 *     logError("storage.setJSON", e, { key, valueType: typeof value });
 *   }
 */

export type ErrorLogEntry = {
  id: number;
  timestamp: number;
  source: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown>;
};

const MAX_ENTRIES = 50;

let buffer: ErrorLogEntry[] = [];
let idCounter = 0;
const subscribers = new Set<(entries: readonly ErrorLogEntry[]) => void>();

/**
 * Record an error. Silently swallows errors from the logger itself
 * (can't have the error logger crash the app).
 */
export function logError(
  source: string,
  error: unknown,
  context?: Record<string, unknown>,
): void {
  try {
    const entry: ErrorLogEntry = {
      id: ++idCounter,
      timestamp: Date.now(),
      source,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      context,
    };

    // Ring buffer: push new, drop oldest if over capacity
    buffer.push(entry);
    if (buffer.length > MAX_ENTRIES) {
      buffer.shift();
    }

    // eslint-disable-next-line no-console
    console.error(
      `[${source}] ${entry.message}`,
      context ? { context } : "",
      error instanceof Error && error.stack ? `\n${error.stack}` : "",
    );

    // Notify subscribers (the debug screen subscribes to update its list)
    for (const sub of subscribers) {
      try {
        sub(buffer);
      } catch {
        // Subscriber threw — ignore, don't let it break the log
      }
    }
  } catch {
    // Absolute last resort: the error logger itself is broken.
    // Fall back to plain console.error with minimal info.
    // eslint-disable-next-line no-console
    console.error("[error-log] internal failure logging error from:", source);
  }
}

/** Read the current buffer snapshot (readonly). */
export function getErrorLog(): readonly ErrorLogEntry[] {
  return buffer;
}

/** Clear all buffered errors. Used by the debug screen "Clear" action. */
export function clearErrorLog(): void {
  buffer = [];
  for (const sub of subscribers) {
    try {
      sub(buffer);
    } catch {
      // ignore
    }
  }
}

/**
 * Subscribe to error log updates. Returns an unsubscribe function.
 * The callback is invoked whenever a new error is logged or the log is cleared.
 */
export function subscribeToErrorLog(
  callback: (entries: readonly ErrorLogEntry[]) => void,
): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
