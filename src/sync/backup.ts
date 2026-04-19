/**
 * Manual cloud backup. Called from the Profile tab's "Backup to Cloud"
 * button. Uploads every row from every synced table to Supabase, one
 * table at a time. Paced at 150ms between tables so supabase-js's
 * token-refresh machinery doesn't see a burst and cascade.
 *
 * There is NO automatic backup. The user taps when they want to
 * snapshot; otherwise the app lives entirely in SQLite.
 */

import { supabase, requireUserId } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { all } from "../db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../db/sqlite/coerce";
import { SYNCED_TABLES, primaryKeyFor } from "./tables";

export interface BackupProgress {
  currentTable: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  rowsUploaded: number;
}

export type BackupResult =
  | { success: true; tablesBackedUp: number; rowsUploaded: number; at: string }
  | { success: false; error: string; errorTable?: string };

const BATCH_SIZE = 500;
const INTER_TABLE_DELAY_MS = 150;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export async function backupToCloud(
  onProgress?: (p: BackupProgress) => void,
): Promise<BackupResult> {
  try {
    await requireUserId();
  } catch {
    return { success: false, error: "auth" };
  }

  try {
    await supabase.auth.refreshSession();
  } catch (e) {
    logError("backup.refreshSession", e);
  }

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
      rowsUploaded: totalRows,
    });

    // Read live + tombstoned rows. Tombstones (`_deleted = 1`) will
    // surface at restore time via the same row, and the downstream pull
    // logic respects them. For now we upload them as upserts; a future
    // revision can translate tombstones to DELETE statements.
    const rows = await all<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE _deleted = 0`,
    );

    if (rows.length > 0) {
      const pkCols = primaryKeyFor(table);
      const cleaned = rows.map((r) =>
        stripSyncColumns(rowFromSqlite(table, r) as Record<string, unknown>),
      );

      for (const batch of chunk(cleaned, BATCH_SIZE)) {
        const { error } = await supabase
          .from(table)
          .upsert(batch as never, { onConflict: pkCols.join(",") });
        if (error) {
          logError("backup.upsert.failed", error, { table });
          return {
            success: false,
            error: error.message ?? "upsert failed",
            errorTable: table,
          };
        }
      }
      totalRows += rows.length;
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
    rowsUploaded: totalRows,
  });

  return {
    success: true,
    tablesBackedUp: total,
    rowsUploaded: totalRows,
    at: new Date().toISOString(),
  };
}
