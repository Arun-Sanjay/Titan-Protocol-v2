/**
 * Manual cloud restore. Called from the Profile tab's "Restore from
 * Cloud" button. Fetches every synced table from Supabase first; only
 * after every page lands does it wipe local SQLite and bulk-insert
 * inside a single transaction. If a fetch fails partway, the local
 * store is untouched and the user can retry without losing data.
 *
 * Destructive — prompts for confirmation in the UI before calling.
 */

import { supabase, requireUserId } from "../lib/session";
import { logError } from "../lib/error-log";
import { run, transaction } from "../db/sqlite/client";
import { rowToSqlite, knownSqliteColumns } from "../db/sqlite/coerce";
import { PULL_ORDER, primaryKeyFor } from "./tables";
import type { Database } from "@titan/shared/types/supabase";

type SyncedTableName = keyof Database["public"]["Tables"];

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
  // userId isn't used below — Supabase RLS filters every SELECT by
  // `auth.uid() = user_id` server-side, so a valid session is what
  // matters. Bound for future per-user local marker writes.
  void userId;

  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    logError("restore.refreshSession", e);
  }

  const tables = PULL_ORDER;
  const total = tables.length;
  let totalRows = 0;

  // Phase 1 — fetch every table into memory. Any error here returns
  // before the local store is touched, so a network failure mid-restore
  // no longer wipes the user's data.
  const staged: Record<string, Record<string, unknown>[]> = {};
  let completed = 0;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    onProgress?.({
      currentTable: table,
      tablesCompleted: completed,
      tablesTotal: total,
      rowsDownloaded: totalRows,
    });

    const collected: Record<string, unknown>[] = [];
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Stable pagination: `.range()` without an explicit order lets
      // Postgres return rows in an arbitrary (and between-page-inconsistent)
      // order, so rows can be silently skipped OR duplicated once a table
      // exceeds one page (~1 active year of completions). Order by the
      // primary key — always present and unique — for a deterministic sweep.
      let query = supabase.from(table as SyncedTableName).select("*");
      for (const pkCol of primaryKeyFor(table)) {
        query = query.order(pkCol, { ascending: true });
      }
      const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        logError("restore.select.failed", error, { table });
        return {
          success: false,
          error: error.message ?? "fetch failed",
          errorTable: table,
        };
      }

      if (!data || data.length === 0) break;
      for (const row of data) collected.push(row as Record<string, unknown>);
      totalRows += data.length;
      if (data.length < PAGE_SIZE) break;
      offset += PAGE_SIZE;
    }

    staged[table] = collected;
    completed++;

    if (i < tables.length - 1) {
      await sleep(INTER_TABLE_DELAY_MS);
    }
  }

  // Phase 2 — atomic swap. Wipe-then-insert inside a single SQLite
  // transaction so a mid-commit failure rolls back to the prior state
  // instead of leaving the user with an empty store.
  try {
    await transaction(async () => {
      for (const table of tables) {
        await run(`DELETE FROM ${table}`);
        const rows = staged[table];
        if (!rows || rows.length === 0) continue;
        for (const row of rows) {
          const sqliteRow = rowToSqlite(table, row);
          sqliteRow._dirty = 0;
          sqliteRow._deleted = 0;
          const cols = knownSqliteColumns(table, sqliteRow);
          const placeholders = cols.map(() => "?").join(", ");
          await run(
            `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
            cols.map((c) => sqliteRow[c]),
          );
        }
      }
    });
  } catch (e) {
    logError("restore.commit.failed", e);
    return {
      success: false,
      error: e instanceof Error ? e.message : "commit failed",
    };
  }

  onProgress?.({
    currentTable: null,
    tablesCompleted: total,
    tablesTotal: total,
    rowsDownloaded: totalRows,
  });

  return {
    success: true,
    tablesRestored: total,
    rowsDownloaded: totalRows,
    at: new Date().toISOString(),
  };
}
