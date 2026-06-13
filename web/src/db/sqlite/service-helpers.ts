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
import { rowFromSqlite, rowToSqlite, stripSyncColumns, knownSqliteColumns } from "./coerce";
import { COLUMN_TYPES } from "./column-types";
import { primaryKeyFor } from "../../sync/tables";
import { markSynced } from "../../sync/sync-status";
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

/**
 * Server-side natural UNIQUE constraints per table (beyond the PK),
 * verified against the live schema. `cloudUpsert` targets these in
 * `onConflict` so replaying a row that lost a cross-device race (the same
 * journal day or the same task+date completion created on another device
 * under a different uuid) UPDATES the existing row instead of failing
 * 23505 forever — a permanently-failing dirty row used to block every
 * catch-up restore, silently freezing cross-device sync on this device.
 */
const NATURAL_KEYS: Record<string, readonly string[]> = {
  achievements_unlocked: ["user_id", "achievement_id"],
  boss_challenges: ["user_id", "boss_id"],
  completions: ["task_id", "date_key"],
  habit_logs: ["habit_id", "date_key"],
  journal_entries: ["user_id", "date_key"],
  meal_logs: ["user_id", "date_key", "name"],
  narrative_entries: ["user_id", "flag"],
  protocol_sessions: ["user_id", "date_key"],
  quests: ["user_id", "week_start_key", "type"],
  skill_tree_progress: ["user_id", "engine", "node_id"],
  sleep_logs: ["user_id", "date_key"],
  water_logs: ["user_id", "date_key"],
  weight_logs: ["user_id", "date_key"],
};

/** Conflict target for a cloud upsert: the natural key where one exists,
 *  the primary key otherwise. */
function conflictTargetFor(table: string): readonly string[] {
  return NATURAL_KEYS[table] ?? primaryKeyFor(table);
}

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
  const cols = knownSqliteColumns(table, sqliteReady);
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

  const { data, error } = await supabase
    .from(table as SyncedTableName)
    .upsert(cloudRow as never, { onConflict: conflictTargetFor(table).join(",") })
    .select()
    .single();

  if (error || !data) {
    await mirrorToSqlite(table, merged, 1);
    throw new Error(`[cloud:${table}] ${error?.message ?? "no data returned"}`);
  }

  const cloudData = data as Record<string, unknown>;
  await mirrorToSqlite(table, cloudData, 0);
  markSynced();
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

  const { data, error } = await supabase
    .from(table as SyncedTableName)
    .upsert(cloudRows as never, { onConflict: conflictTargetFor(table).join(",") })
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
 * Cloud-first single-row read for cache-miss paths. Fetches the row from
 * Supabase by exact column match, mirrors it into SQLite (clean), and
 * returns it — or null when no row exists (or RLS hides it). Throws on
 * network/API failure so callers can distinguish "absent" from
 * "unreachable".
 *
 * Reserved for boot-time flows that may legitimately run before the
 * first-run pull has seeded the cache (e.g. resolving the profile base
 * row). Screens keep reading via the `sqlite*` helpers.
 */
export async function cloudGet<T>(
  table: string,
  keys: Record<string, unknown>,
): Promise<T | null> {
  let query = supabase.from(table as SyncedTableName).select("*");
  for (const [col, val] of Object.entries(keys)) {
    query = query.eq(col, val as never);
  }
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`[cloud:${table}] ${error.message}`);
  if (!data) return null;
  await mirrorToSqlite(table, data as Record<string, unknown>, 0);
  return data as T;
}

/**
 * Cloud delete that THROWS on failure and does NOT tombstone. Used by the
 * dirty-row flush to replay a queued delete: a real failure there must be
 * counted and (after the retry cap) dead-lettered, not silently swallowed.
 * On success, hard-deletes the local row.
 */
export async function cloudDeleteOrThrow(
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

/**
 * Hybrid delete: cloud first, then hard-delete from SQLite. Supabase
 * Realtime notifies any other devices, which hard-delete on their end.
 *
 * On cloud failure (offline / transient) the row is TOMBSTONED locally
 * (`_deleted=1, _dirty=1`) instead of throwing: readers filtered on
 * `_deleted=0` stop seeing it immediately, and `flushDirtyRows` replays
 * the delete (via `cloudDeleteOrThrow`) once connectivity returns. The
 * user's delete intent is never lost, and an offline delete no longer
 * throws an error the UI would (wrongly) surface as "delete failed".
 */
export async function cloudDelete(
  table: string,
  pk: Record<string, unknown>,
): Promise<void> {
  try {
    await cloudDeleteOrThrow(table, pk);
  } catch {
    const pkCols = primaryKeyFor(table);
    const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");
    await run(
      `UPDATE ${table} SET _deleted = 1, _dirty = 1 WHERE ${whereClause}`,
      pkCols.map((c) => pk[c]),
    );
  }
}

/**
 * Whether the cloud copy of row `id` in `table` is strictly newer (by
 * `updated_at`) than `localUpdatedAt`. Used by the dirty-row flush as a
 * last-write-wins guard: `cloudUpsert` re-stamps `updated_at` to now, so
 * replaying a stale offline row would otherwise masquerade as the newest
 * write and revert a newer edit made on another device.
 *
 * Returns `false` when it can't tell — the table has no `id`/`updated_at`,
 * or the row is absent in the cloud (then the caller should push to
 * (re)create it). Throws on network/API error so the caller retries.
 */
export async function remoteIsNewer(
  table: string,
  id: unknown,
  localUpdatedAt: unknown,
): Promise<boolean> {
  if (typeof id !== "string" || typeof localUpdatedAt !== "string") return false;
  // Mirror cloudGet's builder shape (`.select("*")` + a string column arg);
  // narrowing the select to one column makes supabase-js type `.eq`'s column
  // param as `never` under our union-table cast.
  // A `string`-typed column var (not a literal) matches the builder's `.eq`
  // overload under the union-table cast — the same trick cloudGet relies on.
  const idCol: string = "id";
  let query = supabase.from(table as SyncedTableName).select("*");
  query = query.eq(idCol, id as never);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(`[cloud:${table}] ${error.message}`);
  const remote = (data as { updated_at?: unknown } | null)?.updated_at;
  return typeof remote === "string" && remote > localUpdatedAt;
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
