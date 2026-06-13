/**
 * Catch-up resync after a Realtime gap.
 *
 * Supabase Realtime does NOT replay `postgres_changes` that occur while this
 * client's socket is disconnected (laptop sleep, network drop, or the tab
 * parked in the background long enough for the socket to close). Any
 * cross-device edit made during that window never reaches this device — the
 * local SQLite cache never learns about it and nothing re-pulls. That is the
 * "I changed it on my phone but my laptop never showed it" bug: the laptop's
 * socket was down while the phone wrote, so the change was missed for good.
 *
 * This closes the gap: whenever the connection is re-established (realtime
 * re-subscribe), the network comes back (`online`), or the tab refocuses
 * while the socket is down, pull the cloud state back into SQLite. The
 * StreakSettlementGate also forces a run at app-open so settlement never
 * folds days from a stale cache.
 *
 * Order matters — flush local writes UP before pulling cloud DOWN:
 *   1. `flushDirtyRows()` pushes any rows a failed `cloudUpsert` left dirty.
 *   2. Only when that flush actually ran and left nothing dirty do we
 *      `restoreFromCloud()` — the full-table re-pull wipes each table before
 *      re-inserting, so running it with an unsynced local row present (or
 *      with another flush mid-flight, whose rows are still `_dirty=1`)
 *      would drop that row. Otherwise we skip the pull; the next trigger
 *      retries.
 *
 * Concurrency: one flight at a time — concurrent callers AWAIT the same
 * in-flight run and see its real outcome. Throttled so the burst of
 * triggers a laptop-wake fires (online + visibilitychange + realtime
 * re-subscribe) does a single pull, not three.
 */
import type { QueryClient } from "@tanstack/react-query";
import { logError } from "../lib/error-log";
import { invalidateScoring } from "../lib/score-invalidation";
import { flushDirtyRows } from "./flush-dirty";
import { restoreFromCloud } from "./restore";
import { markSynced } from "./sync-status";

/**
 * Outcome of a catch-up attempt. Callers that need a FRESH cache before
 * acting (e.g. streak settlement) must require `"pulled"` — every other
 * status means the local cache may still be stale.
 */
export type ResyncResult =
  | { status: "pulled" }
  | { status: "skipped-throttled" }
  | { status: "skipped-flush-inflight" }
  | { status: "skipped-dirty"; failed: number }
  | { status: "failed" };

let inFlight: Promise<ResyncResult> | null = null;
let lastSuccessAt = 0;
const MIN_INTERVAL_MS = 8000;

export async function catchUpResync(
  queryClient: QueryClient,
  opts: { force?: boolean } = {},
): Promise<ResyncResult> {
  if (inFlight) return inFlight;
  const now = Date.now();
  if (!opts.force && now - lastSuccessAt < MIN_INTERVAL_MS) {
    return { status: "skipped-throttled" };
  }

  inFlight = (async (): Promise<ResyncResult> => {
    try {
      const flush = await flushDirtyRows();
      // Another flush is mid-flight (or there is no user): its rows may
      // still sit `_dirty=1` and the full-table restore below would wipe
      // them. Back off; the next trigger retries.
      if (flush.skipped) return { status: "skipped-flush-inflight" };
      // A dirty row that still failed to push must not be wiped by the
      // full-table restore. Skip this round; the next trigger retries.
      if (flush.failed > 0) {
        return { status: "skipped-dirty", failed: flush.failed };
      }

      const result = await restoreFromCloud();
      if (!result.success) {
        logError("resync.restore.failed", result.error);
        return { status: "failed" };
      }

      lastSuccessAt = Date.now();
      markSynced();
      // SQLite was just rewritten from cloud — refetch every screen, plus
      // the derived score caches (their keys don't match the table
      // predicate).
      queryClient.invalidateQueries();
      invalidateScoring(queryClient);
      return { status: "pulled" };
    } catch (e) {
      logError("resync.failed", e);
      return { status: "failed" };
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}
