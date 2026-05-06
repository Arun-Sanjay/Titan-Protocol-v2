/**
 * Manual cloud backup. Called from the Profile tab's "Backup to Cloud"
 * button. Uploads every row from every synced table to Supabase, one
 * table at a time. Paced at 150ms between tables so supabase-js's
 * token-refresh machinery doesn't see a burst and cascade.
 *
 * Two passes per table:
 *
 *   1. Live rows (`_deleted = 0`) → upsert.
 *   2. Tombstone rows (`_deleted = 1`) → DELETE from cloud, then
 *      hard-delete locally on success.
 *
 * Without the second pass a row deleted on Device A would never leave
 * the cloud, so Device B's next restore would resurrect it. (CLAUDE.md
 * §10 had this listed as open debt — it's now closed.)
 *
 * There is NO automatic backup. The user taps when they want to
 * snapshot; otherwise the app lives entirely in SQLite.
 */

import { supabase, requireUserId } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { all, run } from "../db/sqlite/client";
import { rowFromSqlite, stripSyncColumns } from "../db/sqlite/coerce";
import { COLUMN_TYPES } from "../db/sqlite/column-types";
import { SYNCED_TABLES, primaryKeyFor } from "./tables";

export interface BackupProgress {
  currentTable: string | null;
  tablesCompleted: number;
  tablesTotal: number;
  rowsUploaded: number;
}

export type BackupResult =
  | {
      success: true;
      tablesBackedUp: number;
      rowsUploaded: number;
      rowsDeleted: number;
      at: string;
    }
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

function ownerFilterFor(table: string, userId: string): {
  clause: string;
  params: unknown[];
} {
  if (table === "profiles") return { clause: "id = ?", params: [userId] };
  if (COLUMN_TYPES[table]?.user_id) {
    return { clause: "user_id = ?", params: [userId] };
  }
  // All synced tables should be user-owned. Refuse to back up any table
  // whose ownership model is unknown rather than uploading cross-user rows.
  return { clause: "1 = 0", params: [] };
}

/**
 * Push tombstones to Supabase as DELETEs.
 *
 * Single-PK tables (the common case) → batched `.delete().in(pk, ids)`.
 * Composite-PK tables (`srs_cards`, `user_titles`) → one DELETE per row
 * with chained `.eq()` calls because PostgREST has no `.in()` over a
 * tuple. There are at most a handful of such rows per backup.
 */
async function pushTombstones(
  table: string,
  rows: Record<string, unknown>[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  if (rows.length === 0) return { ok: true, count: 0 };
  const pkCols = primaryKeyFor(table);

  if (pkCols.length === 1) {
    const pk = pkCols[0];
    const ids = rows.map((r) => r[pk]).filter((v) => v != null);
    if (ids.length === 0) return { ok: true, count: 0 };
    let deleted = 0;
    for (const batch of chunk(ids, BATCH_SIZE)) {
      const { error } = await supabase
        .from(table)
        .delete()
        .in(pk, batch as never[]);
      if (error) {
        return { ok: false, error: error.message ?? "delete failed" };
      }
      deleted += batch.length;
    }
    return { ok: true, count: deleted };
  }

  // Composite PK: issue per-row deletes.
  let deleted = 0;
  for (const row of rows) {
    let q = supabase.from(table).delete();
    for (const col of pkCols) {
      q = q.eq(col, row[col] as never);
    }
    const { error } = await q;
    if (error) {
      return { ok: false, error: error.message ?? "delete failed" };
    }
    deleted++;
  }
  return { ok: true, count: deleted };
}

/** Hard-delete tombstone rows from local SQLite once the cloud DELETE landed. */
async function hardDeleteLocal(
  table: string,
  rows: Record<string, unknown>[],
): Promise<void> {
  if (rows.length === 0) return;
  const pkCols = primaryKeyFor(table);
  const where = pkCols.map((c) => `${c} = ?`).join(" AND ");
  for (const row of rows) {
    const params = pkCols.map((c) => row[c]);
    await run(
      `DELETE FROM ${table} WHERE _deleted = 1 AND ${where}`,
      params,
    );
  }
}

export async function backupToCloud(
  onProgress?: (p: BackupProgress) => void,
): Promise<BackupResult> {
  let userId: string;
  try {
    userId = await requireUserId();
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
  let totalDeleted = 0;

  for (let i = 0; i < tables.length; i++) {
    const table = tables[i];
    onProgress?.({
      currentTable: table,
      tablesCompleted: completed,
      tablesTotal: total,
      rowsUploaded: totalRows,
    });

    const ownerFilter = ownerFilterFor(table, userId);

    // ── Pass 1: live rows → upsert. ─────────────────────────────────
    const liveRows = await all<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE _deleted = 0 AND ${ownerFilter.clause}`,
      ownerFilter.params,
    );

    if (liveRows.length > 0) {
      const pkCols = primaryKeyFor(table);
      const cleaned = liveRows.map((r) =>
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
      totalRows += liveRows.length;
    }

    // ── Pass 2: tombstones → cloud DELETE, then local hard-delete. ──
    // Same owner filter so we never propagate a cross-user delete.
    const tombRows = await all<Record<string, unknown>>(
      `SELECT * FROM ${table} WHERE _deleted = 1 AND ${ownerFilter.clause}`,
      ownerFilter.params,
    );
    if (tombRows.length > 0) {
      const cleaned = tombRows.map((r) =>
        rowFromSqlite(table, r) as Record<string, unknown>,
      );
      const res = await pushTombstones(table, cleaned);
      if (!res.ok) {
        logError("backup.delete.failed", new Error(res.error), { table });
        return {
          success: false,
          error: res.error,
          errorTable: table,
        };
      }
      // Tombstones are gone from the cloud — drop them locally too so
      // they don't get retried on the next backup.
      await hardDeleteLocal(table, tombRows);
      totalDeleted += res.count;
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
    rowsDeleted: totalDeleted,
    at: new Date().toISOString(),
  };
}
