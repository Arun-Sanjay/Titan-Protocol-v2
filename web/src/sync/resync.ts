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
 * while the socket is down, pull the cloud state back into SQLite.
 *
 * Order matters — flush local writes UP before pulling cloud DOWN:
 *   1. `flushDirtyRows()` pushes any rows a failed `cloudUpsert` left dirty.
 *   2. Only if nothing is still dirty (`failed === 0`) do we `restoreFromCloud()`
 *      — a full-table re-pull wipes each table before re-inserting, so running
 *      it with an unsynced local row present would drop that row. When a dirty
 *      row remains we skip the pull and let the next trigger retry.
 *
 * Concurrency: one flight at a time; throttled so the burst of triggers a
 * laptop-wake fires (online + visibilitychange + realtime re-subscribe) does
 * a single pull, not three.
 */
import type { QueryClient } from "@tanstack/react-query";
import { logError } from "../lib/error-log";
import { invalidateScoring } from "../lib/score-invalidation";
import { flushDirtyRows } from "./flush-dirty";
import { restoreFromCloud } from "./restore";

let inFlight = false;
let lastSuccessAt = 0;
const MIN_INTERVAL_MS = 8000;

export async function catchUpResync(
  queryClient: QueryClient,
  opts: { force?: boolean } = {},
): Promise<void> {
  if (inFlight) return;
  const now = Date.now();
  if (!opts.force && now - lastSuccessAt < MIN_INTERVAL_MS) return;

  inFlight = true;
  try {
    const flush = await flushDirtyRows();
    // A dirty row that still failed to push must not be wiped by the
    // full-table restore below. Skip this round; the next trigger retries.
    if (flush.failed > 0) return;

    const result = await restoreFromCloud();
    if (!result.success) {
      logError("resync.restore.failed", result.error);
      return;
    }

    lastSuccessAt = Date.now();
    // SQLite was just rewritten from cloud — refetch every screen, plus the
    // derived score caches (their keys don't match the table predicate).
    queryClient.invalidateQueries();
    invalidateScoring(queryClient);
  } catch (e) {
    logError("resync.failed", e);
  } finally {
    inFlight = false;
  }
}
