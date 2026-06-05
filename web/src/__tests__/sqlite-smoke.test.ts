/**
 * SQLite infrastructure smoke test.
 *
 * Exercises the migration SQL against an in-memory better-sqlite3 DB,
 * verifying:
 *   1. The schema applies cleanly (no SQL syntax errors or bad CHECK
 *      constraints).
 *   2. All 44 expected tables exist (42 user-facing + pending_mutations
 *      + sync_meta housekeeping).
 *   3. Core round-trip: insert + select + soft-delete on `tasks`.
 *
 * This doesn't exercise the platform-specific client (sqlite-wasm in
 * browser, tauri-plugin-sql on desktop) — those surface at runtime and
 * are validated by Vite dev + tauri dev. The migration SQL and our
 * column-types / coerce layer are the things that can silently drift;
 * this test catches that drift.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { migrations } from "../db/sqlite/migrations";
import { SYNCED_TABLES } from "../db/sqlite/column-types";

describe("SQLite initial migration", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(":memory:");
    db.pragma("foreign_keys = OFF");
    // Apply the full migration chain (001 + 002 + 003…) so the in-memory
    // schema matches what ships — including later ADD COLUMN / new tables.
    for (const m of migrations) db.exec(m.sql);
  });

  it("creates exactly the tables we expect", () => {
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);

    // 43 user-facing tables + 2 housekeeping (pending_mutations, sync_meta) = 45
    expect(names).toHaveLength(45);
    expect(names).toContain("profiles");
    expect(names).toContain("tasks");
    expect(names).toContain("completions");
    expect(names).toContain("habits");
    expect(names).toContain("srs_cards");
    expect(names).toContain("xp_log");
    expect(names).toContain("pending_mutations");
    expect(names).toContain("sync_meta");
  });

  it("SYNCED_TABLES (column-types.ts) matches user-facing table list", () => {
    const rows = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as { name: string }[];
    const schemaTables = new Set(rows.map((r) => r.name));
    // Every entry in the code map must correspond to a real table. If
    // this fails, someone added a table to the map without a migration,
    // or vice versa.
    for (const t of SYNCED_TABLES) {
      expect(schemaTables.has(t), `missing SQL table for ${t}`).toBe(true);
    }
    expect(SYNCED_TABLES.length).toBe(43);
  });

  it("can round-trip a task row", () => {
    db.prepare(
      `INSERT INTO tasks (id, user_id, engine, title, kind, days_per_week, is_active, created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      "t1",
      "u1",
      "body",
      "Push-ups",
      "main",
      7,
      1,
      "2026-04-22T00:00:00Z",
      "2026-04-22T00:00:00Z",
      0,
      0,
    );

    const row = db
      .prepare(
        "SELECT id, title, engine, kind, is_active FROM tasks WHERE _deleted = 0 AND id = ?",
      )
      .get("t1") as Record<string, unknown>;
    expect(row).toEqual({
      id: "t1",
      title: "Push-ups",
      engine: "body",
      kind: "main",
      is_active: 1,
    });

    // Soft-delete and verify the row drops out of the live view.
    db.prepare("UPDATE tasks SET _deleted = 1 WHERE id = ?").run("t1");
    const gone = db
      .prepare("SELECT id FROM tasks WHERE _deleted = 0 AND id = ?")
      .get("t1");
    expect(gone).toBeUndefined();
  });

  it("enforces the engine CHECK constraint", () => {
    expect(() =>
      db
        .prepare(
          `INSERT INTO tasks (id, user_id, engine, title, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(
          "bad1",
          "u1",
          "bogus",
          "Bad engine",
          "2026-04-22T00:00:00Z",
          "2026-04-22T00:00:00Z",
        ),
    ).toThrow();
  });
});
