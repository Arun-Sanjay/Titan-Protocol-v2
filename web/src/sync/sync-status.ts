/**
 * Live sync state for the settings UI (audit §5.3 — the settings screen used
 * to show a hard-coded green "Cloud sync active" dot regardless of reality).
 *
 * `lastSyncAt` is stamped whenever we successfully reach the cloud (a
 * confirmed `cloudUpsert` or a catch-up pull). `countPendingRows` reports
 * how many local rows are still queued (`_dirty=1`) or dead-lettered
 * (`_dirty=2`) so the UI can show "N changes pending" / "N stuck".
 */
import { all } from "../db/sqlite/client";
import { SYNCED_TABLES } from "./tables";

let lastSyncAt: number | null = null;

/** Call on any confirmed cloud round-trip (cloudUpsert success, resync pull). */
export function markSynced(): void {
  lastSyncAt = Date.now();
}

export function getLastSyncAt(): number | null {
  return lastSyncAt;
}

export interface PendingCounts {
  /** Rows queued for replay (a failed/offline write). */
  pending: number;
  /** Rows abandoned after the retry cap (`_dirty=2`) — surfaced so they're
   *  not invisible; a successful restore replaces them with cloud truth. */
  failed: number;
}

export async function countPendingRows(): Promise<PendingCounts> {
  let pending = 0;
  let failed = 0;
  for (const table of SYNCED_TABLES) {
    try {
      const rows = await all<{ d: number; c: number }>(
        `SELECT _dirty AS d, COUNT(*) AS c FROM ${table} WHERE _dirty != 0 GROUP BY _dirty`,
      );
      for (const r of rows) {
        if (Number(r.d) === 1) pending += Number(r.c);
        else if (Number(r.d) === 2) failed += Number(r.c);
      }
    } catch {
      // Table may be absent on a lagging local schema — ignore.
    }
  }
  return { pending, failed };
}
