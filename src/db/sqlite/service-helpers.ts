/**
 * Local-first service layer helpers.
 *
 * The shape every service uses:
 *
 *   import { sqliteList, sqliteGet, sqliteUpsert, sqliteDelete, newId } from "../db/sqlite/service-helpers";
 *
 *   export async function listThings() {
 *     return sqliteList<Thing>("things", { order: "created_at ASC" });
 *   }
 *   export async function createThing(input: { title: string }) {
 *     const userId = await requireUserId();
 *     return sqliteUpsert("things", {
 *       id: newId(), user_id: userId, title: input.title,
 *     });
 *   }
 *
 * Every mutation: writes to SQLite with `_dirty=1`, enqueues an outbox
 * mutation, and schedules a debounced push via the sync engine. The
 * service function returns the authoritative row synchronously (at
 * SQLite-write latency ~1ms) — the network round-trip is out of the
 * critical path.
 */

import { randomUUID } from "expo-crypto";
import { all, get, run, transaction } from "./client";
import { rowFromSqlite, rowToSqlite, stripSyncColumns } from "./coerce";
import { enqueueDelete, enqueueUpsert } from "../../sync/outbox";
import { scheduleMutationPush } from "../../sync/engine";
import { primaryKeyFor } from "../../sync/tables";

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

/** Count rows in `table` matching an optional WHERE clause. */
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
 * Writes a full row to SQLite and enqueues an upsert to the outbox in
 * one transaction. `updated_at` is refreshed to "now" unless already
 * present; `created_at` defaults to "now" when absent. Returns the
 * final row shape (the one that was persisted + enqueued).
 *
 * Schedules a debounced push so rapid consecutive calls coalesce.
 */
export async function sqliteUpsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Promise<T> {
  const now = new Date().toISOString();
  const finalRow: Record<string, unknown> = { ...row };
  if (finalRow.created_at == null) finalRow.created_at = now;
  // Only touch updated_at if the table actually has the column. Some
  // insert-only tables (completions, habit_logs, narrative_entries, etc.)
  // don't carry updated_at.
  const sqliteReady = rowToSqlite(table, {
    ...finalRow,
    _dirty: 1,
    _deleted: 0,
  });
  if ("updated_at" in sqliteReady) {
    finalRow.updated_at = now;
    sqliteReady.updated_at = now;
  }

  const cols = Object.keys(sqliteReady);
  const placeholders = cols.map(() => "?").join(", ");

  await transaction(async () => {
    await run(
      `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
      cols.map((c) => sqliteReady[c]),
    );
    await enqueueUpsert(table, finalRow);
  });
  scheduleMutationPush();
  return finalRow as T;
}

/**
 * Batch form — writes many rows in one transaction. Used by onboarding
 * and bulk imports to avoid paying the push-schedule overhead per row.
 * All rows get one shared `now` timestamp so an entire batch lines up
 * at the same `updated_at` (helpful for cursor semantics).
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
        _dirty: 1,
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
      await enqueueUpsert(table, finalRow);
    }
  });
  scheduleMutationPush();
  return rows;
}

/**
 * Soft-delete a row by primary key. Marks the row `_deleted=1, _dirty=1`
 * locally (readers with the `_deleted = 0` filter stop seeing it
 * instantly) and enqueues a delete for the push loop.
 */
export async function sqliteDelete(
  table: string,
  pk: Record<string, unknown>,
): Promise<void> {
  await enqueueDelete(table, pk);
  scheduleMutationPush();
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/** Generate a new UUID for a row PK. Matches Supabase's gen_random_uuid(). */
export function newId(): string {
  return randomUUID();
}

/** Re-export the DB primitives for services that need custom SQL. */
export { all, get, run, transaction } from "./client";
