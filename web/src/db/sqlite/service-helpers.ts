/**
 * Service-layer helpers. Two write paths exist after the SaaS pivot:
 *
 *   • `cloudUpsert` / `cloudUpsertMany` / `cloudDelete` — Supabase-first,
 *     mirrors the response into SQLite. Default for new code. Cross-device
 *     sync works because every write hits Supabase, and a Realtime
 *     subscription (see `src/sync/realtime.ts`) pushes the change to
 *     other devices via the same cache mirror.
 *
 *   • `sqliteUpsert` / `sqliteUpsertMany` / `sqliteDelete` — local-only.
 *     Reserved for internal flows that intentionally bypass cloud:
 *       - the Realtime subscriber writing a row received from another device
 *       - first-run cloud pull (we already fetched from cloud; no point in
 *         sending the row back)
 *       - any future offline-queue replay logic
 *
 * Reads (`sqliteList` / `sqliteGet` / `sqliteCount`) always go through SQLite —
 * fast and the user sees no network latency. The Realtime subscriber keeps
 * the cache fresh.
 *
 * Mirrors mobile/src/db/sqlite/service-helpers.ts on the local-only helpers;
 * the `cloud*` family is web-only because mobile's standalone APK is local-only.
 */

import { all, get, run, transaction } from "./client";
import { rowFromSqlite, rowToSqlite, stripSyncColumns } from "./coerce";
import { COLUMN_TYPES } from "./column-types";
import { primaryKeyFor } from "../../sync/tables";
import { supabase } from "../../lib/session";
import type { Database } from "@titan/shared/types/supabase";

// Bridge: the supabase-js client wants a literal-union table name, but our
// generic helpers take `string` so callers don't need to import Database.
// All callers pass a runtime member of SYNCED_TABLES, which IS a real table.
type SyncedTableName = keyof Database["public"]["Tables"];

/** True if the given table actually has the named column.
 *  Used by `cloudUpsert` to decide whether to stamp created_at / updated_at. */
function tableHasColumn(table: string, column: string): boolean {
  const cols = COLUMN_TYPES[table];
  return Boolean(cols && column in cols);
}

/** Conditionally stamp the schema-defined timestamps. Tables vary widely —
 *  some have both, some only one, some neither (focus_sessions, field_ops,
 *  achievements_unlocked, etc.). Without this gate, every cloudUpsert sends
 *  Supabase columns it doesn't recognize and the write fails. */
function applyTimestampStamps(table: string, merged: Record<string, unknown>, nowIso: string): void {
  if (tableHasColumn(table, "created_at")) {
    if (merged.created_at == null) merged.created_at = nowIso;
  } else {
    delete merged.created_at;
  }
  if (tableHasColumn(table, "updated_at")) {
    merged.updated_at = nowIso;
  } else {
    delete merged.updated_at;
  }
}

export interface ListOptions {
  /** Additional WHERE clause (joined with the `_deleted = 0` guard via AND). */
  where?: string;
  params?: unknown[];
  /** Plain ORDER BY clause, e.g. "created_at DESC, id ASC". */
  order?: string;
  limit?: number;
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export async function sqliteList<T>(
  table: string,
  options: ListOptions = {},
): Promise<T[]> {
  const clauses: string[] = ["_deleted = 0"];
  if (options.where) clauses.push(`(${options.where})`);
  const sql =
    `SELECT * FROM ${table} WHERE ${clauses.join(" AND ")}` +
    (options.order ? ` ORDER BY ${options.order}` : "") +
    (options.limit ? ` LIMIT ${options.limit}` : "");
  const rows = await all<Record<string, unknown>>(sql, options.params ?? []);
  return rows.map(
    (r) => rowFromSqlite<T & Record<string, unknown>>(table, stripSyncColumns(r)),
  ) as T[];
}

/** Fetch a row by primary key. Returns `null` if absent or soft-deleted. */
export async function sqliteGet<T>(
  table: string,
  pk: Record<string, unknown>,
): Promise<T | null> {
  const pkCols = primaryKeyFor(table);
  const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
  const pkValues = pkCols.map((c) => pk[c]);
  const row = await get<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE _deleted = 0 AND ${whereClause}`,
    pkValues,
  );
  if (!row) return null;
  return rowFromSqlite<T & Record<string, unknown>>(
    table,
    stripSyncColumns(row),
  ) as T;
}

/** Count rows matching an optional WHERE clause. */
export async function sqliteCount(
  table: string,
  options: { where?: string; params?: unknown[] } = {},
): Promise<number> {
  const clauses: string[] = ["_deleted = 0"];
  if (options.where) clauses.push(`(${options.where})`);
  const row = await get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ${table} WHERE ${clauses.join(" AND ")}`,
    options.params ?? [],
  );
  return row?.c ?? 0;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Write a full row to SQLite. `updated_at` is refreshed to "now" unless
 * already present; `created_at` defaults to "now" when absent. Returns
 * the final row shape (the one that was persisted).
 */
export async function sqliteUpsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<T> {
  const now = new Date().toISOString();
  const finalRow: Record<string, unknown> = { ...row };
  if (finalRow.created_at == null) finalRow.created_at = now;

  const sqliteReady = rowToSqlite(table, {
    ...finalRow,
    _dirty: 0,
    _deleted: 0,
  });
  if ("updated_at" in sqliteReady) {
    finalRow.updated_at = now;
    sqliteReady.updated_at = now;
  }

  const cols = Object.keys(sqliteReady);
  const placeholders = cols.map(() => "?").join(", ");

  await run(
    `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => sqliteReady[c]),
  );
  return finalRow as T;
}

/**
 * Batch write — writes many rows in one transaction. Used by onboarding
 * and bulk imports so a 50-row insert is one commit instead of 50.
 */
export async function sqliteUpsertMany<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();

  await transaction(async () => {
    for (const row of rows) {
      const finalRow: Record<string, unknown> = { ...row };
      if (finalRow.created_at == null) finalRow.created_at = now;

      const sqliteReady = rowToSqlite(table, {
        ...finalRow,
        _dirty: 0,
        _deleted: 0,
      });
      if ("updated_at" in sqliteReady) {
        finalRow.updated_at = now;
        sqliteReady.updated_at = now;
      }

      const cols = Object.keys(sqliteReady);
      const placeholders = cols.map(() => "?").join(", ");
      await run(
        `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
        cols.map((c) => sqliteReady[c]),
      );
    }
  });
  return rows;
}

/**
 * Soft-delete a row by primary key. Marks the row `_deleted=1` locally;
 * readers filtered by `_deleted = 0` stop seeing it instantly. The
 * tombstone is kept so a future backup still knows the row was deleted
 * (important for multi-device restore to converge).
 */
export async function sqliteDelete(
  table: string,
  pk: Record<string, unknown>,
): Promise<void> {
  const pkCols = primaryKeyFor(table);
  const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
  const pkValues = pkCols.map((c) => pk[c]);
  await run(
    `UPDATE ${table} SET _deleted = 1 WHERE ${whereClause}`,
    pkValues,
  );
}

/** Hard-delete a row from SQLite. No tombstone. Used by cloudDelete and the
 *  Realtime subscriber when an upstream DELETE event lands. */
async function sqliteHardDelete(
  table: string,
  pk: Record<string, unknown>,
): Promise<void> {
  const pkCols = primaryKeyFor(table);
  const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
  const pkValues = pkCols.map((c) => pk[c]);
  await run(`DELETE FROM ${table} WHERE ${whereClause}`, pkValues);
}

// ─── Hybrid (Supabase-first) writes ─────────────────────────────────────────

/** Strip housekeeping columns before sending to Supabase. */
function toCloudRow<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const { _dirty: _d, _deleted: _del, ...rest } = row as Record<string, unknown>;
  void _d; void _del;
  return rest;
}

/**
 * Mirror a row into SQLite with a chosen `_dirty` flag. Used both on the
 * success path (clean mirror after a confirmed cloud write) and on the
 * failure path (dirty mirror so a retry pass can re-push it).
 */
async function mirrorToSqlite(
  table: string,
  row: Record<string, unknown>,
  dirty: 0 | 1,
): Promise<void> {
  const sqliteReady = rowToSqlite(table, { ...row, _dirty: dirty, _deleted: 0 });
  const cols = Object.keys(sqliteReady);
  const placeholders = cols.map(() => "?").join(", ");
  await run(
    `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => sqliteReady[c]),
  );
}

/**
 * Hybrid write: Supabase is the source of truth. On success, mirror the
 * canonical row (with any server-side defaults applied) into SQLite and
 * return it. On cloud failure, still mirror locally with `_dirty=1` so
 * the row isn't lost — and throw, so the UI surfaces the error.
 *
 * Use this in services that need cross-device sync. Use `sqliteUpsert`
 * only for flows that intentionally bypass cloud (Realtime subscriber,
 * first-run pull, offline-queue replay).
 */
export async function cloudUpsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<T> {
  const now = new Date().toISOString();
  const merged: Record<string, unknown> = { ...row };
  applyTimestampStamps(table, merged, now);

  const cloudRow = toCloudRow(merged);
  const pkCols = primaryKeyFor(table);

  const { data, error } = await supabase
    .from(table as SyncedTableName)
    .upsert(cloudRow as never, { onConflict: pkCols.join(",") })
    .select()
    .single();

  if (error || !data) {
    await mirrorToSqlite(table, merged, 1);
    throw new Error(`[cloud:${table}] ${error?.message ?? "no data returned"}`);
  }

  const cloudData = data as Record<string, unknown>;
  await mirrorToSqlite(table, cloudData, 0);
  return cloudData as T;
}

/**
 * Batch hybrid write. Cloud-first; on success the canonical rows are
 * mirrored to SQLite. On failure, throws — the partial-success case is
 * caller's problem (today: callers are onboarding-style bulk inserts
 * that re-run whole flows).
 */
export async function cloudUpsertMany<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
): Promise<T[]> {
  if (rows.length === 0) return [];
  const now = new Date().toISOString();
  const cloudRows = rows.map((r) => {
    const merged: Record<string, unknown> = { ...r };
    applyTimestampStamps(table, merged, now);
    return toCloudRow(merged);
  });

  const pkCols = primaryKeyFor(table);

  const { data, error } = await supabase
    .from(table as SyncedTableName)
    .upsert(cloudRows as never, { onConflict: pkCols.join(",") })
    .select();

  if (error || !data) {
    throw new Error(`[cloud:${table}] ${error?.message ?? "no data returned"}`);
  }

  const cloudRowsBack = data as Record<string, unknown>[];
  await transaction(async () => {
    for (const row of cloudRowsBack) {
      await mirrorToSqlite(table, row, 0);
    }
  });

  return cloudRowsBack as T[];
}

/**
 * Hybrid delete: cloud first, then hard-delete from SQLite. No tombstone
 * needed — Supabase Realtime will notify any other devices, which will
 * hard-delete on their end via the subscriber.
 *
 * On cloud failure, throws without touching SQLite. Future retry logic
 * can pick up the cloud-truth state on next list query.
 */
export async function cloudDelete(
  table: string,
  pk: Record<string, unknown>,
): Promise<void> {
  const pkCols = primaryKeyFor(table);

  let query = supabase.from(table as SyncedTableName).delete();
  for (const c of pkCols) {
    query = query.eq(c, pk[c] as never);
  }
  const { error } = await query;
  if (error) throw new Error(`[cloud:${table}] ${error.message}`);

  await sqliteHardDelete(table, pk);
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Generate a new UUID for a row PK. Matches Supabase's gen_random_uuid(). */
export function newId(): string {
  // crypto.randomUUID is available in all modern browsers and in Tauri's
  // WebView (Edge/WebKit) since 2022. Also present in Node 14.17+ for tests.
  return crypto.randomUUID();
}

/** Re-export the DB primitives for services that need custom SQL. */
export { all, get, run, transaction } from "./client";
