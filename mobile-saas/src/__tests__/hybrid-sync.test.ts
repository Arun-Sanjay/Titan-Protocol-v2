/**
 * Hybrid sync semantics — SQLite-side invariants that the cloud-first write
 * path depends on. Doesn't exercise the actual Supabase client (that's the
 * cross-device manual test). Validates that:
 *
 *   1. The schema supports wipe-all-then-insert (used by
 *      wipeAllSyncedTables on sign-out + by atomic restore).
 *   2. The `_dirty` column behaves correctly when a cloud write fails and
 *      we still need to mirror locally with a retry flag.
 *   3. The Realtime DELETE handler's hard-delete works against
 *      REPLICA IDENTITY FULL payloads (single + composite PK).
 *
 * Runs against in-memory better-sqlite3 (the same harness as Classic's
 * sqlite-fake). Mirrors web's `hybrid-sync.test.ts` but uses the
 * template-literal migration import (no Vite `?raw`).
 */

import Database from "better-sqlite3";
import { SQL as SQL_001 } from "../db/sqlite/migrations/001_initial";
import { SYNCED_TABLES } from "../db/sqlite/column-types";

describe("Hybrid sync — SQLite invariants", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = OFF");
    db.exec(SQL_001);
  });

  // ─── wipeAllSyncedTables ─────────────────────────────────────────────────

  test("can wipe every synced table in a single sweep", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "Push-ups", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 0, 0,
    );

    db.prepare(
      `INSERT INTO habits (id, user_id, title, engine, icon, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "h1", "u1", "Meditate", "mind", "🧘",
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 0, 0,
    );

    db.prepare(
      `INSERT INTO weight_logs (id, user_id, date_key, weight_kg, created_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("w1", "u1", "2026-05-26", 75.5, "2026-05-26T00:00:00Z", 0, 0);

    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c,
    ).toBe(1);
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM habits").get() as { c: number }).c,
    ).toBe(1);
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM weight_logs").get() as {
        c: number;
      }).c,
    ).toBe(1);

    // Wipe (mirrors wipeAllSyncedTables transaction).
    db.exec("BEGIN");
    for (const t of SYNCED_TABLES) {
      db.exec(`DELETE FROM ${t}`);
    }
    db.exec("COMMIT");

    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM tasks").get() as { c: number }).c,
    ).toBe(0);
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM habits").get() as { c: number }).c,
    ).toBe(0);
    expect(
      (db.prepare("SELECT COUNT(*) AS c FROM weight_logs").get() as {
        c: number;
      }).c,
    ).toBe(0);
  });

  // ─── _dirty bit semantics ─────────────────────────────────────────────────

  test("preserves the row when cloud write fails (dirty mirror)", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "Push-ups", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 1, 0,
    );

    const row = db
      .prepare("SELECT id, title, _dirty, _deleted FROM tasks WHERE id = ?")
      .get("t1") as { _dirty: number; _deleted: number };

    expect(row._dirty).toBe(1);
    expect(row._deleted).toBe(0);

    const dirties = db
      .prepare("SELECT id FROM tasks WHERE _dirty = 1")
      .all() as { id: string }[];
    expect(dirties.map((r) => r.id)).toEqual(["t1"]);
  });

  test("clearing _dirty after cloud confirms updates the retry queue", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "X", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 1, 0,
    );

    db.prepare("UPDATE tasks SET _dirty = 0 WHERE id = ?").run("t1");

    const dirties = db
      .prepare("SELECT id FROM tasks WHERE _dirty = 1")
      .all() as { id: string }[];
    expect(dirties).toHaveLength(0);
  });

  // ─── Realtime DELETE hard-delete ──────────────────────────────────────────

  test("hard-deletes a row when realtime broadcasts a DELETE event", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "Push-ups", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 0, 0,
    );

    db.prepare("DELETE FROM tasks WHERE id = ?").run("t1");

    const rows = db.prepare("SELECT id FROM tasks").all();
    expect(rows).toHaveLength(0);
  });

  test("handles a composite-PK delete (srs_cards: user_id + exercise_id)", () => {
    db.prepare(
      `INSERT INTO srs_cards (user_id, exercise_id, interval_days, ease_factor, review_count, next_review_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("u1", "ex1", 1, 2.5, 0, "2026-05-27", 0, 0);
    db.prepare(
      `INSERT INTO srs_cards (user_id, exercise_id, interval_days, ease_factor, review_count, next_review_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run("u1", "ex2", 1, 2.5, 0, "2026-05-27", 0, 0);

    db.prepare("DELETE FROM srs_cards WHERE user_id = ? AND exercise_id = ?")
      .run("u1", "ex1");

    const remaining = db
      .prepare("SELECT exercise_id FROM srs_cards ORDER BY exercise_id")
      .all() as { exercise_id: string }[];
    expect(remaining.map((r) => r.exercise_id)).toEqual(["ex2"]);
  });

  // ─── Dirty-row replay (the SELECT side; cloud round-trip is smoke-tested) ─

  test("finds dirty rows across every synced table — the flush retry query", () => {
    // Seed a dirty row in tasks + a clean row in habits + a dirty row in
    // weight_logs. flushDirtyRows() does
    //   SELECT * FROM ${table} WHERE _dirty = 1
    // per table, which is what we exercise here against the real schema.
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "Push-ups", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 1, 0,
    );
    db.prepare(
      `INSERT INTO habits (id, user_id, title, engine, icon, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "h1", "u1", "Meditate", "mind", "🧘",
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 0, 0,
    );
    db.prepare(
      `INSERT INTO weight_logs (id, user_id, date_key, weight_kg, created_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run("w1", "u1", "2026-05-26", 75.5, "2026-05-26T00:00:00Z", 1, 0);

    // COUNT(*) handles composite-PK tables (no `id` column).
    const dirtyByTable: Record<string, number> = {};
    for (const table of SYNCED_TABLES) {
      const row = db
        .prepare(`SELECT COUNT(*) AS c FROM ${table} WHERE _dirty = 1`)
        .get() as { c: number };
      if (row.c > 0) dirtyByTable[table] = row.c;
    }
    expect(dirtyByTable).toEqual({ tasks: 1, weight_logs: 1 });
  });

  test("a successful retry clears _dirty back to 0", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "Push-ups", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:00:00Z", 1, 0,
    );

    // cloudUpsert's mirrorToSqlite(table, data, 0) replays the canonical
    // row with `_dirty = 0` on success. Simulate that with an upsert.
    db.prepare(
      `INSERT OR REPLACE INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1", "u1", "body", "Push-ups", "main", 7, 1,
      "2026-05-26T00:00:00Z", "2026-05-26T00:01:00Z", 0, 0,
    );

    const stillDirty = db
      .prepare("SELECT id FROM tasks WHERE _dirty = 1")
      .all() as { id: string }[];
    expect(stillDirty).toHaveLength(0);
  });
});
