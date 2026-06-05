/**
 * Catch-up resync after a Realtime gap.
 *
 * Supabase Realtime does NOT replay `postgres_changes` that occur while this
 * device's socket is disconnected (iOS backgrounding drops the channel, OS
 * sleep, tunnel/network loss). Any cross-device edit made during that window
 * never reaches this device — the local SQLite cache never learns about it
 * and nothing re-pulls. That is the "changed it on another device but this
 * one never showed it" bug.
 *
 * This closes the gap: when the connection is re-established (realtime
 * re-subscribe) or the app returns to the foreground while the socket is
 * down, pull the cloud state back into SQLite.
 *
 * Order matters — flush local writes UP before pulling cloud DOWN:
 *   1. `flushDirtyRows()` pushes rows a failed `cloudUpsert` left dirty.
 *   2. Only if nothing is still dirty (`failed === 0`) do we `restoreFromCloud()`
 *      — a full-table re-pull wipes each table before re-inserting, so running
 *      it with an unsynced local row present would drop that row. If a dirty
 *      row remains we skip the pull and let the next trigger retry.
 *
 * Concurrency: one flight at a time; throttled so the burst of triggers an
 * app-foreground fires (AppState active + realtime re-subscribe) does a
 * single pull, not several.
 */
import type { QueryClient } from "@tanstack/react-query";
import { logError } from "../lib/error-log";
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
    // SQLite was just rewritten from cloud — refetch every screen (this also
    // covers the derived dashboard / dailyPlanning / analytics score caches).
    queryClient.invalidateQueries();
  } catch (e) {
    logError("resync.failed", e);
  } finally {
    inFlight = false;
  }
}
