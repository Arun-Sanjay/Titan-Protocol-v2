/**
 * First-run cloud pull + sign-out wipe.
 *
 * After the SaaS pivot (P1 of SAAS_ROADMAP.md), Supabase is the source of
 * truth and local SQLite is a per-user read cache. Two helpers keep the
 * cache scoped correctly:
 *
 *   - `pullIfEmpty(userId)` — if this user has no rows locally yet, run a
 *     full restore from Supabase. Idempotent; subsequent calls do nothing.
 *
 *   - `wipeAllSyncedTables()` — called on sign-out so the next user that
 *     signs in on this device starts with a clean cache (and triggers
 *     their own first-run pull).
 */

import { run, transaction } from "../db/sqlite/client";
import { sqliteCount } from "../db/sqlite/service-helpers";
import { logError } from "../lib/error-log";
import { SYNCED_TABLES } from "./tables";
import { restoreFromCloud, type RestoreProgress } from "./restore";

/**
 * Run the first-time cloud pull for this user iff the local cache has no
 * rows scoped to them. Resolves once the pull is done (or skipped). Never
 * throws — failures are logged and the caller can carry on with an empty
 * cache; the user will see empty screens until a manual refresh kicks
 * data in.
 */
export async function pullIfEmpty(
  userId: string,
  onProgress?: (p: RestoreProgress) => void,
): Promise<{ pulled: boolean; ok: boolean }> {
  try {
    // Three representative tables: tasks (most users have at least one),
    // habits (almost always populated), profiles (single row per user on
    // first sign-in). If all three are empty for this user, we're fresh.
    //
    // Profiles is keyed by `id` (matches auth.users.id), not `user_id` —
    // the other tables use the conventional `user_id` FK. Get that wrong
    // and the whole gate throws + falls into the catch + returns
    // `{ pulled: false }`, so the user lands on an empty dashboard.
    const [tasks, habits, profile] = await Promise.all([
      sqliteCount("tasks", { where: "user_id = ?", params: [userId] }),
      sqliteCount("habits", { where: "user_id = ?", params: [userId] }),
      sqliteCount("profiles", { where: "id = ?", params: [userId] }),
    ]);

    if (tasks + habits + profile > 0) {
      return { pulled: false, ok: true };
    }

    const result = await restoreFromCloud(onProgress);
    if (!result.success) {
      logError("first-run-pull.failed", result.error, {
        userId,
        errorTable: "errorTable" in result ? result.errorTable : undefined,
      });
      // The cache is still empty and we couldn't fill it. Report failure so
      // the gate shows an error + Retry instead of rendering "ready" over an
      // empty store — which looks exactly like total data loss.
      return { pulled: true, ok: false };
    }
    return { pulled: true, ok: true };
  } catch (err) {
    logError("first-run-pull.exception", err, { userId });
    return { pulled: false, ok: false };
  }
}

/**
 * Hard-delete every row from every synced table. Used on sign-out so the
 * device's SQLite cache doesn't leak between accounts.
 *
 * Single transaction so a sign-out is atomic — either the cache is wiped
 * or it's untouched.
 */
export async function wipeAllSyncedTables(): Promise<void> {
  try {
    await transaction(async () => {
      for (const table of SYNCED_TABLES) {
        await run(`DELETE FROM ${table}`);
      }
    });
  } catch (err) {
    logError("wipe.failed", err);
    // Best-effort: if the wipe fails, we still let sign-out proceed
    // server-side. The next sign-in's first-run pull check sees stale
    // rows, won't trigger a pull — manual refresh would be needed.
    // Live with it; this path is rare.
  }
}
