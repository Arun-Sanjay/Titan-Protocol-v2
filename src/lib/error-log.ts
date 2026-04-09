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
 * - Phase 7.1: every entry is also forwarded to Sentry as a captured
 *   exception (or message for non-Error inputs) with the source as a
 *   tag and the context object as extra metadata. The ring buffer is
 *   kept for the dev debug screen and as a fallback when Sentry is
 *   disabled (no DSN).
 *
 * Usage:
 *   import { logError } from "@/lib/error-log";
 *   try { ... } catch (e) {
 *     logError("storage.setJSON", e, { key, valueType: typeof value });
 *   }
 */

import * as Sentry from "@sentry/react-native";

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

    // Phase 7.1: forward to Sentry. captureException for real Errors
    // gives us a proper stack trace; captureMessage covers the case
    // where someone passed a string or object literal as the error.
    try {
      if (error instanceof Error) {
        Sentry.captureException(error, {
          tags: { source },
          extra: context,
        });
      } else {
        Sentry.captureMessage(`[${source}] ${entry.message}`, {
          level: "error",
          tags: { source },
          extra: { ...context, raw: String(error) },
        });
      }
    } catch {
      // Sentry can fail (e.g. before init in tests). Don't let it break
      // the local logging.
    }

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
