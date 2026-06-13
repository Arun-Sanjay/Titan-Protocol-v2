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
 * Replay order: FK parents before children. Postgres enforces the
 * references the local cache doesn't, so an offline-created task + its
 * completion must arrive in that order or the child 23503s on the first
 * round.
 *
 * Failure semantics: a transiently failing row stays `_dirty=1` and is
 * retried on the next flush. A row that keeps failing (unique/FK/RLS
 * conflict that will never clear) is ABANDONED after
 * `MAX_REPLAY_ATTEMPTS`: marked `_dirty=2`, loudly logged, and excluded
 * from future scans — one poison row must not block the catch-up restore
 * forever (resync skips the pull while `_dirty=1` failures remain). The
 * next successful restore replaces abandoned rows with cloud truth.
 */
import { all, run } from "../db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../db/sqlite/coerce";
import {
  cloudUpsert,
  cloudGet,
  cloudDeleteOrThrow,
  remoteIsNewer,
} from "../db/sqlite/service-helpers";
import { SYNCED_TABLES, primaryKeyFor } from "./tables";
import { logError } from "../lib/error-log";
import { getCurrentUserId } from "../lib/session";

let inFlight = false;

const MAX_REPLAY_ATTEMPTS = 3;
/** Transient failures (offline / 5xx / timeout) retry far longer than
 *  permanent conflicts before being abandoned — dropping a row that merely
 *  hit a network blip would let the next catch-up restore overwrite it with
 *  cloud truth and lose the user's offline edit. The ceiling still exists so
 *  a never-clearing failure can't freeze catch-up sync forever. */
const MAX_TRANSIENT_ATTEMPTS = 12;
/** In-session failure counts per row (`table:pk`). */
const replayFailures = new Map<string, number>();

/** A replay failure that will NEVER clear no matter how many retries — a
 *  uniqueness / foreign-key / RLS / not-null conflict. These hit the low
 *  (poison-row) retry cap; everything else is treated as transient. */
function isPermanentReplayFailure(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("violates") ||
    msg.includes("duplicate key") ||
    msg.includes("constraint") ||
    msg.includes("row-level security") ||
    msg.includes("permission denied")
  );
}

/** FK parents that must reach Supabase before their children. Everything
 *  not listed follows alphabetically (no other cloud FKs between synced
 *  tables). */
const PUSH_FIRST: readonly string[] = [
  "profiles",
  "tasks",
  "habits",
  "deep_work_tasks",
  "gym_templates",
  "gym_exercises",
  "gym_sessions",
];
const PUSH_ORDER: readonly string[] = [
  ...PUSH_FIRST,
  ...SYNCED_TABLES.filter((t) => !PUSH_FIRST.includes(t)).sort(),
];

export async function flushDirtyRows(): Promise<{
  retried: number;
  failed: number;
  abandoned: number;
  skipped: boolean;
}> {
  // Concurrency guard. A flush triggered while another is in progress
  // would race the same rows; bail out and let the in-flight one finish.
  if (inFlight) return { retried: 0, failed: 0, abandoned: 0, skipped: true };

  // No user → cloudUpsert would throw immediately. Bail.
  if (!getCurrentUserId()) {
    return { retried: 0, failed: 0, abandoned: 0, skipped: true };
  }

  inFlight = true;
  let retried = 0;
  let failed = 0;
  let abandoned = 0;

  try {
    for (const table of PUSH_ORDER) {
      const dirties = await all<Record<string, unknown>>(
        `SELECT * FROM ${table} WHERE _dirty = 1`,
      );
      if (dirties.length === 0) continue;

      const pkCols = primaryKeyFor(table);
      for (const raw of dirties) {
        const rowKey = `${table}:${pkCols.map((c) => String(raw[c])).join("|")}`;
        try {
          if (Number(raw._deleted) === 1) {
            // Pending offline delete (tombstone) → replay as a real cloud
            // DELETE, not an upsert. An upsert would resurrect the row the
            // user deleted. cloudDeleteOrThrow hard-deletes the local
            // tombstone on success and throws on a real failure (counted +
            // dead-lettered below, same as a failed upsert).
            const pk = Object.fromEntries(pkCols.map((c) => [c, raw[c]]));
            await cloudDeleteOrThrow(table, pk);
          } else {
            // Decode SQLite-stored values back into JS types, then strip the
            // sync-housekeeping columns (`_dirty`, `_deleted`) — they're not
            // valid Supabase columns.
            const decoded = rowFromSqlite(
              table,
              raw,
            ) as unknown as Record<string, unknown>;
            const cleaned = stripSyncColumns(decoded);

            // Last-write-wins guard: cloudUpsert re-stamps updated_at=now, so
            // a stale offline row would masquerade as newest and revert a
            // newer edit another device made while we were offline. If the
            // cloud copy is newer, adopt it (cloudGet mirrors clean, clearing
            // _dirty) instead of pushing ours.
            if (await remoteIsNewer(table, decoded.id, decoded.updated_at)) {
              await cloudGet(table, { id: decoded.id });
            } else {
              // cloudUpsert: success clears _dirty back to 0 via its
              // mirrorToSqlite(0); failure re-mirrors _dirty=1 and throws.
              await cloudUpsert(table, cleaned);
            }
          }
          replayFailures.delete(rowKey);
          retried++;
        } catch (err) {
          const failures = (replayFailures.get(rowKey) ?? 0) + 1;
          replayFailures.set(rowKey, failures);
          // Permanent conflicts (unique/FK/RLS) will never clear — abandon
          // them quickly so one poison row can't block catch-up sync.
          // Transient failures retry far longer to avoid dropping an offline
          // edit, but still cap out so sync can't freeze forever.
          const cap = isPermanentReplayFailure(err)
            ? MAX_REPLAY_ATTEMPTS
            : MAX_TRANSIENT_ATTEMPTS;
          if (failures >= cap) {
            try {
              await run(
                `UPDATE ${table} SET _dirty = 2 WHERE ${pkCols
                  .map((c) => `${c} = ?`)
                  .join(" AND ")}`,
                pkCols.map((c) => raw[c]),
              );
              replayFailures.delete(rowKey);
              abandoned++;
              logError("flush-dirty.abandoned", err, { table, rowKey });
            } catch (markErr) {
              failed++;
              logError("flush-dirty.abandon-failed", markErr, { table });
            }
          } else {
            failed++;
            logError("flush-dirty.row", err, { table });
          }
        }
      }
    }
  } finally {
    inFlight = false;
  }

  return { retried, failed, abandoned, skipped: false };
}
