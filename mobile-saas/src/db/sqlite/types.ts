import type { Database } from "../../types/supabase";

/** Names of all synced public-schema tables. */
export type TableName = keyof Database["public"]["Tables"];

/** Row shape for a specific table — matches the Supabase Row type 1:1. */
export type Row<T extends TableName> = Database["public"]["Tables"][T]["Row"];

/**
 * Housekeeping columns every synced user-data table carries in SQLite
 * (see 001_initial.sql). They never leave the device — stripped before a
 * row is pushed to Supabase.
 *
 *   _dirty    = 1 when local changes are pending push
 *   _deleted  = 1 when the row is soft-deleted locally; the sync push
 *               turns this into a DELETE against Supabase, after which
 *               the local row is hard-deleted
 */
export interface SyncColumns {
  _dirty: 0 | 1;
  _deleted: 0 | 1;
}

/** Row as read from SQLite — Supabase Row shape + sync bookkeeping. */
export type SqliteRow<T extends TableName> = Row<T> & SyncColumns;
