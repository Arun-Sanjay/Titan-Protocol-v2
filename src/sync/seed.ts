import { get, run } from "../db/sqlite/client";
import { supabase } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { pullTable } from "./pull";
import { PULL_ORDER } from "./tables";

/**
 * A sentinel row in `sync_meta` that records the userId whose data
 * this install was last seeded with. SeedGate uses it to detect the
 * "signed out + signed back in as a different user on the same
 * device" case and wipe before re-seeding, so user A's tasks never
 * leak into user B's session.
 */
const USER_MARKER_ROW = "__user__";

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
 * Has this device been seeded for the given user? Checks the
 * `__user__` marker row in `sync_meta`. If the marker is absent, this
 * is a fresh install OR a pre-marker legacy seed — treat as un-seeded
 * so we run a fresh pull. If the marker is for a different userId,
 * the caller must wipe and re-seed before exposing stale data.
 */
export async function seededForUser(userId: string): Promise<boolean> {
  const row = await get<{ last_pulled_at: string | null }>(
    `SELECT last_pulled_at FROM sync_meta WHERE table_name = ?`,
    [USER_MARKER_ROW],
  );
  return row?.last_pulled_at === userId;
}

/**
 * Legacy — returns true once ANY seed has completed on this install.
 * Kept for places (like dev screens) that just want "is there local
 * data". New call sites should prefer `seededForUser`.
 */
export async function hasSeeded(): Promise<boolean> {
  const row = await get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM sync_meta`,
  );
  return (row?.c ?? 0) > 0;
}

async function writeUserMarker(userId: string): Promise<void> {
  await run(
    `INSERT INTO sync_meta (table_name, last_pulled_at) VALUES (?, ?)
     ON CONFLICT(table_name) DO UPDATE SET last_pulled_at = excluded.last_pulled_at`,
    [USER_MARKER_ROW, userId],
  );
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

/** Short pause between sequential pulls so supabase-js's internal token
 *  machinery has a chance to settle. Without this, 42 back-to-back
 *  queries can trigger a refresh cascade that ends in a 429 on /token
 *  and a spurious SIGNED_OUT. See useAuthStore for the recovery layer. */
const INTER_TABLE_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Full initial pull for a fresh sign-in on this device. Pulls each
 * table in `PULL_ORDER` (profiles first, then dependents alphabetically).
 * Idempotent — can be re-run safely; merge semantics handle the overlap.
 *
 * Writes the `__user__` sentinel to `sync_meta` on success so
 * `seededForUser(userId)` can distinguish "seeded for this user" from
 * "seeded for a different user who previously used this device".
 *
 * `onProgress` is called once per table started and once on completion.
 * The UI (SyncingScreen) uses it to show "Syncing (3 / 42)…".
 */
export async function initialSeed(
  userId: string,
  onProgress?: (p: SeedProgress) => void,
  options: { interTableDelayMs?: number; skipRefresh?: boolean } = {},
): Promise<SeedResult> {
  const delayMs = options.interTableDelayMs ?? INTER_TABLE_DELAY_MS;
  const total = PULL_ORDER.length;
  let completed = 0;
  let totalRows = 0;

  // Proactively refresh the session so every pull hits a freshly-issued
  // token. Supabase tokens live for ~1h — one refresh up front means the
  // 42 pulls below run entirely inside that window without triggering
  // supabase-js's per-request EXPIRY_MARGIN_MS refresh check. Errors are
  // swallowed: if refresh fails (offline, 429), the pulls will surface
  // their own auth error with proper classification.
  if (!options.skipRefresh) {
    try {
      await supabase.auth.refreshSession();
    } catch (e) {
      logError("initialSeed.refreshSession", e);
    }
  }

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

    // Pace the pulls. Small enough that seeding 42 tables still finishes
    // in ~7s; large enough that supabase-js doesn't see a tight burst.
    if (completed < total && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  await writeUserMarker(userId);

  onProgress?.({
    currentTable: null,
    tablesCompleted: total,
    tablesTotal: total,
    totalRowsPulled: totalRows,
  });

  return { success: true, totalRows };
}
