/**
 * Dirty-row replay. The hybrid `cloudUpsert` mirrors locally with
 * `_dirty = 1` whenever the cloud write fails (network blip, server 5xx,
 * Supabase token glitch) so the user's data isn't lost. This module is
 * the second half of that bargain: scan every synced table for `_dirty=1`
 * rows and retry them.
 *
 * Invoked by `WebAuthProvider` on:
 *   • user-id change (first land after sign-in)
 *   • window `online` event (network reconnects)
 *   • document `visibilitychange` returning to visible (tab refocus)
 *
 * Concurrency: one flight at a time. A second call while one is in
 * progress is a no-op rather than queueing — if there are still dirty
 * rows when the first flight ends, the next trigger picks them up.
 *
 * Failure semantics: each row's failure is logged; the row stays
 * `_dirty=1` and will be retried on the next flush. The function only
 * throws if SQLite itself errors (which would be a bigger problem).
 */
import { all } from "../db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../db/sqlite/coerce";
import { cloudUpsert } from "../db/sqlite/service-helpers";
import { SYNCED_TABLES } from "./tables";
import { logError } from "../lib/error-log";
import { getCurrentUserId } from "../lib/session";

let inFlight = false;

export async function flushDirtyRows(): Promise<{
  retried: number;
  failed: number;
  skipped: boolean;
}> {
  // Concurrency guard. A flush triggered while another is in progress
  // would race the same rows; bail out and let the in-flight one finish.
  if (inFlight) return { retried: 0, failed: 0, skipped: true };

  // No user → cloudUpsert would throw immediately. Bail.
  if (!getCurrentUserId()) return { retried: 0, failed: 0, skipped: true };

  inFlight = true;
  let retried = 0;
  let failed = 0;

  try {
    for (const table of SYNCED_TABLES) {
      const dirties = await all<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE _dirty = 1`,
      );
      if (dirties.length === 0) continue;

      for (const raw of dirties) {
        try {
          // Decode SQLite-stored values back into JS types, then strip the
          // sync-housekeeping columns (`_dirty`, `_deleted`) — they're not
          // valid Supabase columns.
          const decoded = rowFromSqlite(
            table,
            raw,
          ) as unknown as Record<string, unknown>;
          const cleaned = stripSyncColumns(decoded);

          // cloudUpsert: success path clears _dirty back to 0 via its
          // mirrorToSqlite(0); failure path mirrors with _dirty=1 again
          // (same as the original write) and throws.
          await cloudUpsert(table, cleaned);
          retried++;
        } catch (err) {
          failed++;
          logError("flush-dirty.row", err, { table });
        }
      }
    }
  } finally {
    inFlight = false;
  }

  return { retried, failed, skipped: false };
}
