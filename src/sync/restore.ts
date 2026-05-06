/**
 * Manual cloud restore. Called from the Profile tab's "Restore from
 * Cloud" button. Replaces the device's local SQLite store with whatever
 * the user's Supabase account currently holds.
 *
 * Two-phase to preserve local data on failure (the previous version
 * wiped local state BEFORE pulling, so a network/RLS error mid-pull
 * left the device with partial data):
 *
 *   1. Stage — pull every table into memory. If any fetch fails, abort.
 *      Local SQLite is untouched.
 *   2. Apply — inside a single SQLite transaction: wipe synced tables
 *      and re-insert the staged rows. Commit-or-rollback semantics
 *      guarantee no half-state.
 *
 * Memory cost: dominated by the largest single table. For a v1 user
 * (single device, ≤ a few thousand rows per table) this is well under
 * 10 MB. If a future user grows past that, switch to a swap-table
 * strategy (CREATE temp tables, INSERT, RENAME).
 *
 * Destructive — confirmed via Alert in CloudBackupSection before this
 * function is called.
 */

import { supabase, requireUserId } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { run, transaction } from "../db/sqlite/client";
import { rowToSqlite } from "../db/sqlite/coerce";
import { SYNCED_TABLES, primaryKeyFor } from "./tables";

export interface RestoreProgress {
  currentTable: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  rowsDownloaded: number;
}

export type RestoreResult =
  | { success: true; tablesRestored: number; rowsDownloaded: number; at: string }
  | { success: false; error: string; errorTable?: string };

const PAGE_SIZE = 500;
const INTER_TABLE_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function restoreFromCloud(
  onProgress?: (p: RestoreProgress) => void,
): Promise<RestoreResult> {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return { success: false, error: "auth" };
  }
  // userId isn't used below because Supabase RLS filters every SELECT
  // by `auth.uid() = user_id` server-side; the presence of a session is
  // what matters. Kept bound so future per-user local operations (e.g.
  // writing a user marker) can reach it.
  void userId;

  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    logError("restore.refreshSession", e);
  }

  // ─── Phase 1: Stage — fetch every table to memory. ───────────────────
  // If any single table fails, return the error and leave SQLite alone.
  const tables = SYNCED_TABLES;
  const total = tables.length;
  const staged: Record<string, Record<string, unknown>[]> = {};
  let totalRows = 0;
  let completed = 0;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    onProgress?.({
      currentTable: table,
      tablesCompleted: completed,
      tablesTotal: total,
      rowsDownloaded: totalRows,
    });

    const rows: Record<string, unknown>[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        logError("restore.select.failed", error, { table });
        return {
          success: false,
          error: error.message ?? "fetch failed",
          errorTable: table,
        };
      }

      if (!data || data.length === 0) break;
      rows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    staged[table] = rows;
    totalRows += rows.length;
    completed++;

    if (i < tables.length - 1) {
      await sleep(INTER_TABLE_DELAY_MS);
    }
  }

  // ─── Phase 2: Apply atomically. ──────────────────────────────────────
  // Wipe + reinsert inside one SQLite transaction so a power loss /
  // exception rolls back to the pre-restore state. This is the failure
  // mode the staging phase exists to support.
  try {
    await transaction(async () => {
      for (const table of tables) {
        await run(`DELETE FROM ${table}`);
        const rows = staged[table];
        if (!rows || rows.length === 0) continue;

        for (const row of rows) {
          const sqliteRow = rowToSqlite(table, row);
          // Cloud rows are by definition live (deletes were already
          // pushed during the most recent backup). Mark _dirty=0 so
          // the next backup doesn't re-upload them, and _deleted=0
          // because they exist.
          sqliteRow._dirty = 0;
          sqliteRow._deleted = 0;
          const cols = Object.keys(sqliteRow);
          const placeholders = cols.map(() => "?").join(", ");
          await run(
            `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
            cols.map((c) => sqliteRow[c]),
          );
        }
      }
    });
  } catch (e) {
    logError("restore.apply.failed", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "apply failed",
    };
  }

  onProgress?.({
    currentTable: null,
    tablesCompleted: total,
    tablesTotal: total,
    rowsDownloaded: totalRows,
  });

  void primaryKeyFor; // quiet unused import if no conflict resolution added

  return {
    success: true,
    tablesRestored: total,
    rowsDownloaded: totalRows,
    at: new Date().toISOString(),
  };
}
