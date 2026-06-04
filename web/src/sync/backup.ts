/**
 * Manual cloud backup. Called from the Profile tab's "Backup to Cloud"
 * button. Uploads every row from every synced table to Supabase, one
 * table at a time. Paced at 150ms between tables so supabase-js's
 * token-refresh machinery doesn't see a burst and cascade.
 *
 * There is NO automatic backup. The user taps when they want to
 * snapshot; otherwise the app lives entirely in SQLite.
 */

import { supabase, requireUserId } from "../lib/session";
import { logError } from "../lib/error-log";
import { all, run } from "../db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../db/sqlite/coerce";
import { SYNCED_TABLES, primaryKeyFor } from "./tables";
import type { Database } from "@titan/shared/types/supabase";

// Tighten the dynamic `supabase.from(table)` callsite below: the client
// type wants a literal union, but `table` comes from the runtime
// SYNCED_TABLES array. All entries *are* real Supabase tables, so the
// cast is safe at runtime.
type SyncedTableName = keyof Database["public"]["Tables"];

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

    // 1) Push live rows as upserts.
    const pkCols = primaryKeyFor(table);
    const rows = await all<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE _deleted = 0`,
    );

    if (rows.length > 0) {
      const cleaned = rows.map((r) =>
        stripSyncColumns(rowFromSqlite(table, r) as Record<string, unknown>),
      );

      for (const batch of chunk(cleaned, BATCH_SIZE)) {
        const { error } = await supabase
          .from(table as SyncedTableName)
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

    // 2) Push tombstones as DELETEs. Without this step, soft-deleted
    // rows would re-materialise on a peer that pulls from cloud — the
    // upsert path can't represent "deleted" since deleted rows aren't
    // uploaded.
    const tombstones = await all<Record<string, unknown>>(
      `SELECT ${pkCols.join(", ")} FROM ${table} WHERE _deleted = 1`,
    );

    if (tombstones.length > 0) {
      if (pkCols.length === 1) {
        const col = pkCols[0];
        const ids = tombstones.map((r) => r[col]);
        for (const batch of chunk(ids, BATCH_SIZE)) {
          const { error } = await supabase
            .from(table as SyncedTableName)
            .delete()
            .in(col, batch as never);
          if (error) {
            logError("backup.delete.failed", error, { table });
            return {
              success: false,
              error: error.message ?? "delete failed",
              errorTable: table,
            };
          }
        }
      } else {
        // Composite PK — match() handles multi-column WHERE per row.
        for (const ts of tombstones) {
          const filter: Record<string, unknown> = {};
          for (const col of pkCols) filter[col] = ts[col];
          const { error } = await supabase
            .from(table as SyncedTableName)
            .delete()
            .match(filter as never);
          if (error) {
            logError("backup.delete.failed", error, { table });
            return {
              success: false,
              error: error.message ?? "delete failed",
              errorTable: table,
            };
          }
        }
      }

      // Cloud confirmed the deletes — purge local tombstones so the
      // SQLite store doesn't accumulate dead rows across backups.
      await run(`DELETE FROM ${table} WHERE _deleted = 1`);
      totalRows += tombstones.length;
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
