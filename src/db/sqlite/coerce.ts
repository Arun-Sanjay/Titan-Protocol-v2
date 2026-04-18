import { COLUMN_TYPES, type ColumnKind, type TableColumns } from "./column-types";

// ─── Single-value coercion ──────────────────────────────────────────────────

export function valueFromSqlite(kind: ColumnKind, v: unknown): unknown {
  if (v == null) return v;
  switch (kind) {
    case "boolean":
      return Boolean(v);
    case "json":
      if (typeof v === "string") {
        try {
          return JSON.parse(v);
        } catch {
          return v;
        }
      }
      return v;
    default:
      return v;
  }
}

export function valueToSqlite(kind: ColumnKind, v: unknown): unknown {
  if (v == null) return v;
  switch (kind) {
    case "boolean":
      return v ? 1 : 0;
    case "json":
      if (typeof v === "string") return v;
      return JSON.stringify(v);
    default:
      return v;
  }
}

// ─── Row-level coercion ─────────────────────────────────────────────────────

function columns(table: string): TableColumns {
  const cols = COLUMN_TYPES[table];
  if (!cols) throw new Error(`Unknown synced table: ${table}`);
  return cols;
}

/**
 * Convert a row as read from SQLite (INTEGER booleans, JSON strings) into
 * its JS-typed domain shape. Does NOT strip the `_dirty`/`_deleted`
 * housekeeping columns — use `stripSyncColumns` for that before handing
 * the row to user-facing code or Supabase.
 */
export function rowFromSqlite<T extends Record<string, unknown>>(
  table: string,
  row: Record<string, unknown>,
): T {
  const cols = columns(table);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const kind = cols[key];
    if (!kind) {
      // Column not in the map — pass through (might be SQLite housekeeping
      // from a join or a future column added to SQLite but not yet mapped).
      out[key] = row[key];
      continue;
    }
    out[key] = valueFromSqlite(kind, row[key]);
  }
  return out as T;
}

/**
 * Convert a JS-typed row into its SQLite-ready shape (booleans → 0/1,
 * JSON → strings). Keys not present in the column map pass through
 * unchanged — the caller is responsible for not passing unknown columns.
 */
export function rowToSqlite<T extends Record<string, unknown>>(
  table: string,
  row: T,
): Record<string, unknown> {
  const cols = columns(table);
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    const kind = cols[key];
    if (!kind) {
      out[key] = row[key];
      continue;
    }
    out[key] = valueToSqlite(kind, row[key]);
  }
  return out;
}

/**
 * Remove SQLite-only housekeeping columns before a row crosses the
 * process boundary (going out to Supabase, or being returned from a
 * service function to the UI).
 */
export function stripSyncColumns<T extends Record<string, unknown>>(
  row: T,
): Omit<T, "_dirty" | "_deleted"> {
  const { _dirty: _d, _deleted: _del, ...rest } = row as unknown as Record<string, unknown>;
  return rest as Omit<T, "_dirty" | "_deleted">;
}
