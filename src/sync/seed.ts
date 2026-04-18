import { get, run } from "../db/sqlite/client";
import { pullTable } from "./pull";
import { PULL_ORDER } from "./tables";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SeedProgress {
  currentTable: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  totalRowsPulled: number;
}

export type SeedResult =
  | { success: true; totalRows: number }
  | { success: false; error: string; errorTable?: string };

// ─── Seed state ─────────────────────────────────────────────────────────────

/**
 * Has an initial seed ever completed for this install? We don't have a
 * per-user first-sync marker — instead we check whether `sync_meta` has
 * at least one row. sync_meta is only written after a successful pull,
 * so its presence means we've synced something.
 */
export async function hasSeeded(): Promise<boolean> {
  const row = await get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sync_meta`,
  );
  return (row?.c ?? 0) > 0;
}

/**
 * Wipe all local data. Used when a different user signs in on this
 * device (so we don't mix user A's data with user B's). Does NOT touch
 * schema_migrations — we want to keep the applied-migration record.
 * sync_meta is wiped so `hasSeeded()` correctly reports false until the
 * next user's seed completes.
 */
export async function resetLocalDataForUserSwitch(): Promise<void> {
  for (const table of PULL_ORDER) {
    await run(`DELETE FROM ${table}`);
  }
  await run(`DELETE FROM pending_mutations`);
  await run(`DELETE FROM sync_meta`);
}

// ─── Seeding ────────────────────────────────────────────────────────────────

/**
 * Full initial pull for a fresh sign-in on this device. Pulls each
 * table in `PULL_ORDER` (profiles first, then dependents alphabetically).
 * Idempotent — can be re-run safely; merge semantics handle the overlap.
 *
 * `onProgress` is called once per table started and once on completion.
 * The UI (SyncingScreen) uses it to show "Syncing (3 / 42)…".
 */
export async function initialSeed(
  onProgress?: (p: SeedProgress) => void,
): Promise<SeedResult> {
  const total = PULL_ORDER.length;
  let completed = 0;
  let totalRows = 0;

  onProgress?.({
    currentTable: PULL_ORDER[0] ?? null,
    tablesCompleted: 0,
    tablesTotal: total,
    totalRowsPulled: 0,
  });

  for (const table of PULL_ORDER) {
    onProgress?.({
      currentTable: table,
      tablesCompleted: completed,
      tablesTotal: total,
      totalRowsPulled: totalRows,
    });

    const res = await pullTable(table, { fullRefresh: true });

    if (res.stopReason === "auth") {
      return { success: false, error: "auth", errorTable: table };
    }
    if (res.stopReason === "transient") {
      return {
        success: false,
        error: res.error ?? "network",
        errorTable: table,
      };
    }

    completed++;
    totalRows += res.pulled;
  }

  onProgress?.({
    currentTable: null,
    tablesCompleted: total,
    tablesTotal: total,
    totalRowsPulled: totalRows,
  });

  return { success: true, totalRows };
}
