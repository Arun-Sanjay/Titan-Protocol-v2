import { supabase } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { COLUMN_TYPES } from "../db/sqlite/column-types";
import { rowToSqlite } from "../db/sqlite/coerce";
import { all, get, run, transaction } from "../db/sqlite/client";
import { classifyError } from "./errors";
import { primaryKeyFor } from "./tables";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PullTableResult {
  table: string;
  pulled: number;
  skippedDirty: number;
  stopReason: "complete" | "auth" | "transient";
  error?: string;
}

export interface SyncMetaRow {
  table_name: string;
  last_pulled_at: string | null;
  last_push_ok: string | null;
  last_pull_ok: string | null;
}

// ─── Cursor helpers ─────────────────────────────────────────────────────────

export async function readCursor(table: string): Promise<string | null> {
  const row = await get<{ last_pulled_at: string | null }>(
    `SELECT last_pulled_at FROM sync_meta WHERE table_name = ?`,
    [table],
  );
  return row?.last_pulled_at ?? null;
}

async function writeCursor(table: string, lastPulledAt: string): Promise<void> {
  await run(
    `INSERT INTO sync_meta (table_name, last_pulled_at, last_pull_ok)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(table_name) DO UPDATE SET
       last_pulled_at = excluded.last_pulled_at,
       last_pull_ok   = excluded.last_pull_ok`,
    [table, lastPulledAt],
  );
}

// ─── Per-table cursor column ───────────────────────────────────────────────

/**
 * Preference order for incremental-pull cursors. The first column in
 * this list that exists on the table is chosen. `updated_at` is best
 * because it catches both INSERTs and UPDATEs; the later candidates
 * are fallbacks for insert-only tables (achievements, field_ops,
 * mind_training results, etc.) that don't carry a mutable timestamp.
 */
const CURSOR_CANDIDATES = [
  "updated_at",
  "created_at",
  "unlocked_at",
  "completed_at",
  "ended_at",
  "started_at",
  "achieved_at",
  "answered_at",
  "seen_at",
  "flagged_at",
  "last_event_at",
] as const;

function cursorColumn(table: string): string | null {
  const cols = COLUMN_TYPES[table];
  if (!cols) return null;
  for (const c of CURSOR_CANDIDATES) {
    if (c in cols) return c;
  }
  return null;
}

// ─── Merge semantics ────────────────────────────────────────────────────────

/**
 * Merge one remote row into SQLite with last-write-wins semantics.
 *
 *   - Local row absent                   → insert remote, _dirty=0
 *   - Local clean (_dirty=0)             → replace with remote
 *   - Local dirty, pending DELETE        → skip (don't resurrect)
 *   - Local dirty, remote newer          → replace; log overwrite
 *   - Local dirty, local newer/same      → skip (push will win)
 *
 * Returns whether the row was accepted.
 */
async function mergeRow(
  table: string,
  remoteRow: Record<string, unknown>,
): Promise<"replaced" | "skipped_dirty"> {
  const pkCols = primaryKeyFor(table);
  const pkValues = pkCols.map((c) => remoteRow[c]);
  const whereClause = pkCols.map((c) => `${c} = ?`).join(" AND ");

  const local = await get<{
    _dirty: number;
    _deleted: number;
    updated_at?: string | null;
  }>(
    `SELECT _dirty, _deleted,
            ${"updated_at" in (COLUMN_TYPES[table] ?? {}) ? "updated_at" : "NULL AS updated_at"}
       FROM ${table} WHERE ${whereClause}`,
    pkValues,
  );

  if (local?._dirty === 1) {
    if (local._deleted === 1) return "skipped_dirty"; // pending delete
    const remoteTs = remoteRow.updated_at;
    if (
      typeof remoteTs === "string" &&
      typeof local.updated_at === "string" &&
      remoteTs <= local.updated_at
    ) {
      return "skipped_dirty"; // local is newer or same
    }
    // Remote newer — let the local dirty change get overwritten. LWW.
    // Log so we see when this happens.
    logError(
      "sync.pull.overwroteDirty",
      new Error(`LWW overwrote local dirty row in ${table}`),
      { table, pk: pkValues, remoteTs, localTs: local.updated_at },
    );
  }

  const sqliteRow = rowToSqlite(table, remoteRow);
  sqliteRow._dirty = 0;
  sqliteRow._deleted = 0;
  const cols = Object.keys(sqliteRow);
  const placeholders = cols.map(() => "?").join(", ");
  await run(
    `INSERT OR REPLACE INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => sqliteRow[c]),
  );
  return "replaced";
}

// ─── Single-table pull ──────────────────────────────────────────────────────

const PAGE_SIZE = 500;

export async function pullTable(
  table: string,
  options: { fullRefresh?: boolean } = {},
): Promise<PullTableResult> {
  const cursorCol = cursorColumn(table);
  if (!cursorCol) {
    logError(
      "sync.pull.noCursor",
      new Error(`Table has no updated_at/created_at: ${table}`),
      { table },
    );
    return {
      table,
      pulled: 0,
      skippedDirty: 0,
      stopReason: "complete",
    };
  }

  const startCursor = options.fullRefresh ? null : await readCursor(table);
  let cursor = startCursor;
  let pulled = 0;
  let skippedDirty = 0;
  let maxSeen: string | null = startCursor;

  while (true) {
    let q = supabase.from(table).select("*").limit(PAGE_SIZE);
    if (cursor) {
      q = q.gt(cursorCol, cursor);
    }
    q = q.order(cursorCol, { ascending: true });

    try {
      const { data, error } = await q;
      if (error) throw error;
      if (!data || data.length === 0) break;

      // Merge rows inside a transaction for atomicity and speed.
      await transaction(async () => {
        for (const row of data) {
          const outcome = await mergeRow(table, row as Record<string, unknown>);
          if (outcome === "replaced") pulled++;
          else skippedDirty++;
        }
      });

      const last = data[data.length - 1] as Record<string, unknown>;
      const lastCursorVal = last[cursorCol];
      if (typeof lastCursorVal === "string") {
        maxSeen = lastCursorVal;
        cursor = lastCursorVal;
      }

      if (data.length < PAGE_SIZE) break;
    } catch (err) {
      const cls = classifyError(err);
      if (cls === "auth") {
        return {
          table,
          pulled,
          skippedDirty,
          stopReason: "auth",
          error: extractMessage(err),
        };
      }
      return {
        table,
        pulled,
        skippedDirty,
        stopReason: "transient",
        error: extractMessage(err),
      };
    }
  }

  if (maxSeen) await writeCursor(table, maxSeen);

  return { table, pulled, skippedDirty, stopReason: "complete" };
}

// ─── Multi-table pull ──────────────────────────────────────────────────────

export interface PullAllResult {
  perTable: PullTableResult[];
  totalPulled: number;
  totalSkipped: number;
  stopReason: "complete" | "auth";
}

export async function pullAll(
  tables: readonly string[],
  options: { fullRefresh?: boolean } = {},
): Promise<PullAllResult> {
  const perTable: PullTableResult[] = [];
  let totalPulled = 0;
  let totalSkipped = 0;

  for (const t of tables) {
    const res = await pullTable(t, options);
    perTable.push(res);
    totalPulled += res.pulled;
    totalSkipped += res.skippedDirty;
    if (res.stopReason === "auth") {
      return { perTable, totalPulled, totalSkipped, stopReason: "auth" };
    }
  }

  return { perTable, totalPulled, totalSkipped, stopReason: "complete" };
}

function extractMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(err ?? "unknown");
}
