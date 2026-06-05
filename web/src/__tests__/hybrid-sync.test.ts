/**
 * Hybrid sync semantics — SQLite-side invariants that the new cloud-first
 * write path depends on.
 *
 * Doesn't exercise the actual Supabase client (that's an integration target
 * for the dev environment + the production smoke test). Instead we validate
 * that:
 *
 *   1. The schema supports a wipe-all-then-insert pattern (used by
 *      wipeAllSyncedTables on sign-out + by atomic restore).
 *   2. The `_dirty` column behaves correctly when a cloud write fails and
 *      we still need to mirror locally with a retry flag.
 *   3. The Realtime DELETE handler's hard-delete works against
 *      REPLICA IDENTITY FULL payloads.
 *
 * Runs against an in-memory better-sqlite3, matching the rest of the
 * vitest harness.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { migrations } from "../db/sqlite/migrations";
import { SYNCED_TABLES } from "../db/sqlite/column-types";

describe("Hybrid sync — SQLite invariants", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = OFF");
    // Apply the full migration chain so every SYNCED_TABLES table exists
    // (incl. xp_log from 003), matching the shipped schema.
    for (const m of migrations) db.exec(m.sql);
  });

  // ─── wipeAllSyncedTables ─────────────────────────────────────────────────

  it("can wipe every synced table in a single sweep", () => {
    // Seed: one row in three different tables.
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "Push-ups", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 0, 0);

    db.prepare(
      `INSERT INTO habits (id, user_id, title, engine, icon, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("h1", "u1", "Meditate", "mind", "🧘",
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 0, 0);

    db.prepare(
      `INSERT INTO weight_logs (id, user_id, date_key, weight_kg, created_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("w1", "u1", "2026-05-24", 75.5, "2026-05-24T00:00:00Z", 0, 0);

    expect((db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS c FROM habits").get() as { c: number }).c).toBe(1);
    expect((db.prepare("SELECT COUNT(*) AS c FROM weight_logs").get() as { c: number }).c).toBe(1);

    // Wipe (mirrors wipeAllSyncedTables transaction). Inside the txn we
    // DELETE every SYNCED_TABLE row.
    db.exec("BEGIN");
    for (const t of SYNCED_TABLES) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec("COMMIT");

    expect((db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c).toBe(0);
    expect((db.prepare("SELECT COUNT(*) AS c FROM habits").get() as { c: number }).c).toBe(0);
    expect((db.prepare("SELECT COUNT(*) AS c FROM weight_logs").get() as { c: number }).c).toBe(0);
  });

  // ─── _dirty bit semantics ─────────────────────────────────────────────────

  it("preserves the row when cloud write fails (dirty mirror)", () => {
    // Simulate: cloudUpsert tried to send the row to Supabase, network
    // failed, so we wrote locally with _dirty=1 instead.
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "Push-ups", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 1, 0);

    const row = db
      .prepare("SELECT id, title, _dirty, _deleted FROM tasks WHERE id = ?")
      .get("t1") as { _dirty: number; _deleted: number };

    expect(row._dirty).toBe(1);
    expect(row._deleted).toBe(0);

    // A later "retry sync" path can find all dirty rows.
    const dirties = db
      .prepare("SELECT id FROM tasks WHERE _dirty = 1")
      .all() as { id: string }[];
    expect(dirties.map((r) => r.id)).toEqual(["t1"]);
  });

  it("clearing _dirty after cloud confirms updates the retry queue", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "X", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 1, 0);

    // Simulate: retry succeeded — clear _dirty.
    db.prepare("UPDATE tasks SET _dirty = 0 WHERE id = ?").run("t1");

    const dirties = db
      .prepare("SELECT id FROM tasks WHERE _dirty = 1")
      .all() as { id: string }[];
    expect(dirties).toHaveLength(0);
  });

  // ─── Realtime DELETE hard-delete ──────────────────────────────────────────

  it("hard-deletes a row when realtime broadcasts a DELETE event", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "Push-ups", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 0, 0);

    // Simulate the realtime handler's DELETE branch: PK is in payload.old.
    db.prepare("DELETE FROM tasks WHERE id = ?").run("t1");

    const rows = db.prepare("SELECT id FROM tasks").all();
    expect(rows).toHaveLength(0);
  });

  it("handles a composite-PK delete (srs_cards: user_id + exercise_id)", () => {
    db.prepare(
      `INSERT INTO srs_cards (user_id, exercise_id, interval_days, ease_factor, review_count, next_review_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("u1", "ex1", 1, 2.5, 0, "2026-05-25", 0, 0);
    db.prepare(
      `INSERT INTO srs_cards (user_id, exercise_id, interval_days, ease_factor, review_count, next_review_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("u1", "ex2", 1, 2.5, 0, "2026-05-25", 0, 0);

    // DELETE one composite row.
    db.prepare("DELETE FROM srs_cards WHERE user_id = ? AND exercise_id = ?")
      .run("u1", "ex1");

    const remaining = db
      .prepare("SELECT exercise_id FROM srs_cards ORDER BY exercise_id")
      .all() as { exercise_id: string }[];
    expect(remaining.map((r) => r.exercise_id)).toEqual(["ex2"]);
  });

  // ─── Dirty-row replay (the SELECT side; cloud round-trip is smoke-tested) ─

  it("finds dirty rows across every synced table — the flush retry query", () => {
    // Seed a dirty row in tasks + a clean row in habits + a dirty row in
    // weight_logs. flushDirtyRows() does
    //   SELECT * FROM ${table} WHERE _dirty = 1
    // per table, which is what we exercise here against the real schema.
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "Push-ups", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 1, 0);
    db.prepare(
      `INSERT INTO habits (id, user_id, title, engine, icon, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("h1", "u1", "Meditate", "mind", "🧘",
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 0, 0);
    db.prepare(
      `INSERT INTO weight_logs (id, user_id, date_key, weight_kg, created_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("w1", "u1", "2026-05-24", 75.5, "2026-05-24T00:00:00Z", 1, 0);

    // Collect dirty-row counts per table, the same way flushDirtyRows iterates.
    // Use COUNT(*) so the test handles composite-PK tables (srs_cards,
    // user_titles, focus_settings, etc.) which have no `id` column.
    const dirtyByTable: Record<string, number> = {};
    for (const table of SYNCED_TABLES) {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE _dirty = 1`)
        .get() as { c: number };
      if (row.c > 0) dirtyByTable[table] = row.c;
    }
    expect(dirtyByTable).toEqual({ tasks: 1, weight_logs: 1 });
  });

  it("a successful retry would clear _dirty back to 0", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "Push-ups", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:00:00Z", 1, 0);

    // cloudUpsert's mirrorToSqlite(table, data, 0) replays the canonical
    // row with `_dirty = 0` on success. Simulate that with an upsert.
    db.prepare(
      `INSERT OR REPLACE INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("t1", "u1", "body", "Push-ups", "main", 7, 1,
          "2026-05-24T00:00:00Z", "2026-05-24T00:01:00Z", 0, 0);

    const stillDirty = db
      .prepare("SELECT id FROM tasks WHERE _dirty = 1")
      .all() as { id: string }[];
    expect(stillDirty).toHaveLength(0);
  });
});
