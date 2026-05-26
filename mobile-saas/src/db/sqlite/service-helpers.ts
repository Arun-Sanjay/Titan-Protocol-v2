/**
 * Service-layer helpers — hybrid (SaaS mobile) edition.
 *
 * Reads stay local (~1ms): `sqliteList`, `sqliteGet`, `sqliteCount`.
 *
 * Writes go cloud-first via `cloudUpsert` / `cloudUpsertMany` / `cloudDelete`
 * — Supabase first, mirror the canonical row into SQLite, return the
 * canonical row to the caller. Services should use the cloud family;
 * the plain `sqlite*` write helpers below are reserved for the Realtime
 * subscriber (which is *receiving* from cloud) and the first-run pull
 * (which is *seeding* from cloud).
 *
 * Usage:
 *
 *   import {
 *     sqliteList, sqliteGet, cloudUpsert, cloudDelete, newId,
 *   } from "../db/sqlite/service-helpers";
 *
 *   export async function listThings() {
 *     return sqliteList<Thing>("things", { order: "created_at ASC" });
 *   }
 *   export async function createThing(input: { title: string }) {
 *     const userId = await requireUserId();
 *     return cloudUpsert("things", {
 *       id: newId(), user_id: userId, title: input.title,
 *     });
 *   }
 *
 * `cloudUpsert` resolves when Supabase confirms + the SQLite mirror
 * lands — usually <500ms on good network. On failure the row is mirrored
 * locally with `_dirty=1` so a future retry path can replay it; M2 ships
 * the dirty marker, retry logic is a documented follow-up.
 */

import { randomUUID } from "expo-crypto";
import { all, get, run, transaction } from "./client";
import { rowFromSqlite, rowToSqlite, stripSyncColumns } from "./coerce";
import { COLUMN_TYPES } from "./column-types";
import { primaryKeyFor } from "../../sync/tables";
import { requireUserId, supabase } from "../../lib/supabase";
import type { Database } from "../../types/supabase";

type SyncedTableName = keyof Database["public"]["Tables"];

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

function ownerColumnFor(table: string): string | null {
  if (table === "profiles") return "id";
  return tableHasColumn(table, "user_id") ? "user_id" : null;
}

async function ownerScopeFor(table: string): Promise<{
  clause: string | null;
  params: unknown[];
}> {
  const ownerColumn = ownerColumnFor(table);
  if (!ownerColumn) return { clause: null, params: [] };

  const userId = await requireUserId();
  return { clause: `${ownerColumn} = ?`, params: [userId] };
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
  const params: unknown[] = [];
  const ownerScope = await ownerScopeFor(table);
  if (ownerScope.clause) {
    clauses.push(ownerScope.clause);
    params.push(...ownerScope.params);
  }
  if (options.where) clauses.push(`(${options.where})`);
  params.push(...(options.params ?? []));
  const sql =
    `SELECT * FROM ${table} WHERE ${clauses.join(" AND ")}` +
    (options.order ? ` ORDER BY ${options.order}` : "") +
    (options.limit ? ` LIMIT ${options.limit}` : "");
  const rows = await all<Record<string, unknown>>(sql, params);
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
  const clauses: string[] = [
    "_deleted = 0",
    pkCols.map((c) => `${c} = ?`).join(" AND "),
  ];
  const params = pkCols.map((c) => pk[c]);
  const ownerScope = await ownerScopeFor(table);
  if (ownerScope.clause) {
    clauses.push(ownerScope.clause);
    params.push(...ownerScope.params);
  }
  const row = await get<Record<string, unknown>>(
    `SELECT * FROM ${table} WHERE ${clauses.join(" AND ")}`,
    params,
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
  const params: unknown[] = [];
  const ownerScope = await ownerScopeFor(table);
  if (ownerScope.clause) {
    clauses.push(ownerScope.clause);
    params.push(...ownerScope.params);
  }
  if (options.where) clauses.push(`(${options.where})`);
  params.push(...(options.params ?? []));
  const row = await get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM ${table} WHERE ${clauses.join(" AND ")}`,
    params,
  );
  return row?.c ?? 0;
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Write a full row to SQLite. `updated_at` is refreshed to "now" unless
 * already present; `created_at` defaults to "now" when absent **and**
 * the table actually has that column (many of the user-scoped, one-row
 * tables don't — `skill_tree_progress`, `focus_settings`,
 * `nutrition_profile`, `progression`, `titan_mode_state`,
 * `field_op_cooldown`, `srs_cards`, `user_titles`). Auto-adding a
 * `created_at` to a row destined for one of those tables produces a
 * "no such column" SQLite error at INSERT time — the exact silent
 * failure that made `setSkillNodeReady` (and therefore every skill-tree
 * unlock) a no-op until this fix.
 */
export async function sqliteUpsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<T> {
  const now = new Date().toISOString();
  const finalRow: Record<string, unknown> = { ...row };
  if (finalRow.created_at == null && tableHasColumn(table, "created_at")) {
    finalRow.created_at = now;
  }

  const sqliteReady = rowToSqlite(table, {
    ...finalRow,
    _dirty: 0,
    _deleted: 0,
  });
  if (tableHasColumn(table, "updated_at")) {
    finalRow.updated_at = now;
    sqliteReady.updated_at = now;
  }

  const cols = Object.keys(sqliteReady).filter(
    (c) => tableHasColumn(table, c) || c === "_dirty" || c === "_deleted",
  );
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
      if (finalRow.created_at == null && tableHasColumn(table, "created_at")) {
        finalRow.created_at = now;
      }

      const sqliteReady = rowToSqlite(table, {
        ...finalRow,
        _dirty: 0,
        _deleted: 0,
      });
      if (tableHasColumn(table, "updated_at")) {
        finalRow.updated_at = now;
        sqliteReady.updated_at = now;
      }

      const cols = Object.keys(sqliteReady).filter(
        (c) => tableHasColumn(table, c) || c === "_dirty" || c === "_deleted",
      );
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
  const clauses: string[] = [pkCols.map((c) => `${c} = ?`).join(" AND ")];
  const params = pkCols.map((c) => pk[c]);
  const ownerScope = await ownerScopeFor(table);
  if (ownerScope.clause) {
    clauses.push(ownerScope.clause);
    params.push(...ownerScope.params);
  }
  await run(
    `UPDATE ${table} SET _deleted = 1 WHERE ${clauses.join(" AND ")}`,
    params,
  );
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Generate a new UUID for a row PK. Matches Supabase's gen_random_uuid(). */
export function newId(): string {
  return randomUUID();
}

/** Re-export the DB primitives for services that need custom SQL. */
export { all, get, run, transaction } from "./client";

// ─── Hybrid (Supabase-first) writes ─────────────────────────────────────────

/** Strip housekeeping columns before sending to Supabase. */
function toCloudRow<T extends Record<string, unknown>>(
  row: T,
): Record<string, unknown> {
  const { _dirty: _d, _deleted: _del, ...rest } = row as Record<string, unknown>;
  void _d;
  void _del;
  return rest;
}

async function mirrorToSqlite(
  table: string,
  row: Record<string, unknown>,
  dirty: 0 | 1,
): Promise<void> {
  const sqliteReady = rowToSqlite(table, {
    ...row,
    _dirty: dirty,
    _deleted: 0,
  });
  const cols = Object.keys(sqliteReady);
  const placeholders = cols.map(() => "?").join(", ");
  await run(
    `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => sqliteReady[c]),
  );
}

/**
 * Write a row to Supabase, then mirror the canonical row back into
 * SQLite. Resolves with the canonical row Supabase returned. Stamps
 * `updated_at` and (if missing) `created_at` to now.
 *
 * On cloud failure: mirrors the local copy with `_dirty=1` and throws.
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
    throw new Error(
      `[cloud:${table}] ${error?.message ?? "no data returned"}`,
    );
  }

  const cloudData = data as Record<string, unknown>;
  await mirrorToSqlite(table, cloudData, 0);
  return cloudData as T;
}

/**
 * Batch variant of `cloudUpsert`. Wraps the local mirror writes in a
 * single SQLite transaction so a mid-batch failure doesn't leave
 * partially-applied state in the cache.
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
    throw new Error(
      `[cloud:${table}] ${error?.message ?? "no data returned"}`,
    );
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
 * Delete a row from Supabase + hard-delete the matching SQLite row. Use
 * the `pk` object to scope the delete by every primary-key column —
 * composite-PK tables (srs_cards, user_titles, etc.) need every column
 * to fire the correct DELETE.
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

  const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
  await run(
    `DELETE FROM ${table} WHERE ${whereClause}`,
    pkCols.map((c) => pk[c]),
  );
}
