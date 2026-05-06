/**
 * Regression tests for the tombstone-propagation fix in src/sync/backup.ts.
 *
 * Before the fix, backup filtered with `WHERE _deleted = 0`, so a row
 * deleted on Device A never left the cloud and reappeared on Device B's
 * next restore. The fix adds a second pass per table that pushes
 * tombstones as DELETEs and hard-deletes them locally on success.
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
// Build the supabase fake INSIDE the factory so jest's hoisted mock can
// reach it. The factory exposes the fake on globalThis so the test body
// can read calls and seed errors.
jest.mock("../../lib/supabase", () => {
  const { makeSupabaseFake } = require("../setup/supabase-fake");
  const built = makeSupabaseFake();
  (globalThis as { __mockSupabaseFake?: unknown }).__mockSupabaseFake = built;
  return {
    requireUserId: async () => "u1",
    supabase: {
      from: built.supabase.from,
      auth: { refreshSession: async () => ({}) },
    },
  };
});

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import { backupToCloud } from "../../sync/backup";
import type { SupabaseFakeState, SupabaseCall } from "../setup/supabase-fake";

function getFake(): {
  supabase: { from: (table: string) => unknown };
  state: SupabaseFakeState;
} {
  return (globalThis as unknown as {
    __mockSupabaseFake: {
      supabase: { from: (table: string) => unknown };
      state: SupabaseFakeState;
    };
  }).__mockSupabaseFake;
}

function deleteCalls(calls: SupabaseCall[], table: string) {
  return calls.filter((c) => c.method === "delete" && c.table === table);
}
function upsertCalls(calls: SupabaseCall[], table: string) {
  return calls.filter((c) => c.method === "upsert" && c.table === table);
}

describe("backup tombstone propagation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    _resetTestDb();
    getFake().state.reset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("a soft-deleted single-PK row is sent to Supabase as a DELETE.in", async () => {
    const db = _testDb();
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title, _deleted) VALUES (?, ?, ?, ?, 1)",
    ).run("doomed-1", "u1", "mind", "deleted task");

    const pending = backupToCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.rowsDeleted).toBe(1);
      expect(result.rowsUploaded).toBe(0);
    }

    const dels = deleteCalls(getFake().state.calls, "tasks");
    expect(dels).toHaveLength(1);
    expect(dels[0].delete?.inFilter).toEqual({
      col: "id",
      values: ["doomed-1"],
    });

    // Tombstone hard-deleted locally so the next backup doesn't replay it.
    const remaining = db
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE id = ?")
      .get("doomed-1") as { c: number };
    expect(remaining.c).toBe(0);
  });

  test("live rows still upsert; both passes run for the same table", async () => {
    const db = _testDb();
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title) VALUES (?, ?, ?, ?)",
    ).run("live-1", "u1", "body", "active task");
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title, _deleted) VALUES (?, ?, ?, ?, 1)",
    ).run("doomed-1", "u1", "mind", "deleted task");

    const pending = backupToCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(true);
    expect(upsertCalls(getFake().state.calls, "tasks")).toHaveLength(1);
    expect(deleteCalls(getFake().state.calls, "tasks")).toHaveLength(1);
  });

  test("tombstone stays locally if the cloud DELETE fails", async () => {
    const db = _testDb();
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title, _deleted) VALUES (?, ?, ?, ?, 1)",
    ).run("doomed-1", "u1", "mind", "deleted task");

    getFake().state.setDeleteError("tasks", { message: "rls denied" });

    const pending = backupToCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.errorTable).toBe("tasks");
    }

    const remaining = db
      .prepare("SELECT _deleted FROM tasks WHERE id = ?")
      .get("doomed-1") as { _deleted: number } | undefined;
    expect(remaining?._deleted).toBe(1);
  });

  test("composite-PK tables delete row-by-row via .eq() chains", async () => {
    const db = _testDb();
    // user_titles has composite PK (user_id, title_id).
    db.prepare(
      "INSERT INTO user_titles (user_id, title_id, equipped, _deleted) VALUES (?, ?, ?, 1)",
    ).run("u1", "title_alpha", 0);

    const pending = backupToCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(true);
    const dels = deleteCalls(getFake().state.calls, "user_titles");
    expect(dels).toHaveLength(1);
    expect(dels[0].delete?.inFilter).toBeUndefined();
    expect(dels[0].delete?.conditions).toEqual(
      expect.arrayContaining([
        ["user_id", "u1"],
        ["title_id", "title_alpha"],
      ]),
    );

    const remaining = db
      .prepare(
        "SELECT COUNT(*) AS c FROM user_titles WHERE user_id = ? AND title_id = ?",
      )
      .get("u1", "title_alpha") as { c: number };
    expect(remaining.c).toBe(0);
  });

  test("only the current user's tombstones are pushed", async () => {
    const db = _testDb();
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title, _deleted) VALUES (?, ?, ?, ?, 1)",
    ).run("u1-doomed", "u1", "body", "mine");
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title, _deleted) VALUES (?, ?, ?, ?, 1)",
    ).run("u2-doomed", "u2", "body", "not mine");

    const pending = backupToCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(true);
    const dels = deleteCalls(getFake().state.calls, "tasks");
    expect(dels).toHaveLength(1);
    expect(dels[0].delete?.inFilter).toEqual({
      col: "id",
      values: ["u1-doomed"],
    });

    // u2's tombstone untouched locally — we never write across users.
    const u2 = db
      .prepare("SELECT _deleted FROM tasks WHERE id = ?")
      .get("u2-doomed") as { _deleted: number } | undefined;
    expect(u2?._deleted).toBe(1);
  });
});
