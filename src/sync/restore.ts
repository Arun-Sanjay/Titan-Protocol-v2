/**
 * Manual cloud restore. Called from the Profile tab's "Restore from
 * Cloud" button. Wipes local data (tombstones + live rows) and replaces
 * it with whatever the user's Supabase account currently holds.
 *
 * Destructive — prompts for confirmation in the UI before calling.
 */

import { supabase, requireUserId } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { run } from "../db/sqlite/client";
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

/** Wipe every synced user-data table. Keeps schema_migrations intact. */
async function wipeLocal(): Promise<void> {
  for (const table of SYNCED_TABLES) {
    await run(`DELETE FROM ${table}`);
  }
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

  await wipeLocal();

  const tables = SYNCED_TABLES;
  const total = tables.length;
  let completed = 0;
  let totalRows = 0;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    onProgress?.({
      currentTable: table,
      tablesCompleted: completed,
      tablesTotal: total,
      rowsDownloaded: totalRows,
    });

    // Paginate in case the user has thousands of rows in one table.
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

      // Insert each row with _dirty=0, _deleted=0.
      for (const row of data) {
        const sqliteRow = rowToSqlite(table, row as Record<string, unknown>);
        sqliteRow._dirty = 0;
        sqliteRow._deleted = 0;
        const cols = Object.keys(sqliteRow);
        const placeholders = cols.map(() => "?").join(", ");
        await run(
          `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
          cols.map((c) => sqliteRow[c]),
        );
      }

      totalRows += data.length;
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    completed++;

    if (i < tables.length - 1) {
      await sleep(INTER_TABLE_DELAY_MS);
    }
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
