jest.mock("../../db/sqlite/service-helpers", () => {
  const actual = jest.requireActual("../../db/sqlite/service-helpers");
  return {
    ...actual,
    cloudUpsert: actual.sqliteUpsert,
    cloudUpsertMany: actual.sqliteUpsertMany,
    cloudDelete: actual.sqliteDelete,
  };
});

/**
 * Integration tests for src/services/tasks.ts.
 *
 * Pure SQLite — no sync, no network, no queuing. Uses the in-memory
 * better-sqlite3 shim via jest.mock. expo-crypto's randomUUID is
 * replaced with a deterministic counter so snapshots are stable.
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () =>
    (globalThis as { __testUserId?: string }).__testUserId ?? "u1",
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));

jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    const g = globalThis as { __idCounter?: number };
    g.__idCounter = (g.__idCounter ?? 0) + 1;
    return `test-id-${g.__idCounter}`;
  },
}));

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import {
  createTask,
  deleteTask,
  listTasks,
  listTasksByEngine,
  listCompletionsForDate,
  toggleCompletion,
  toggleCompletionAndAward,
  computeEngineScore,
} from "../../services/tasks";

describe("tasks service", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
    (globalThis as { __testUserId?: string }).__testUserId = "u1";
  });

  describe("createTask", () => {
    test("inserts into SQLite and returns the JS-typed row", async () => {
      const row = await createTask({
        title: "Read Atomic Habits",
        engine: "mind",
      });
      expect(row.id).toBe("test-id-1");
      expect(row.title).toBe("Read Atomic Habits");
      expect(row.is_active).toBe(true);
      expect(row.kind).toBe("main");

      const all = await listTasks();
      expect(all).toHaveLength(1);
      expect(all[0]).toEqual(row);
    });

    test("booleans stay booleans end-to-end (no 0/1 leakage)", async () => {
      const row = await createTask({ title: "x", engine: "body" });
      expect(typeof row.is_active).toBe("boolean");
      const [read] = await listTasks();
      expect(typeof read.is_active).toBe("boolean");
    });
  });

  describe("listTasks / listTasksByEngine", () => {
    test("excludes soft-deleted rows", async () => {
      await createTask({ title: "a", engine: "mind" });
      await createTask({ title: "b", engine: "mind" });
      await deleteTask("test-id-1");

      const all = await listTasks();
      expect(all).toHaveLength(1);
      expect(all[0].id).toBe("test-id-2");
    });

    test("filters by engine", async () => {
      await createTask({ title: "mind-1", engine: "mind" });
      await createTask({ title: "body-1", engine: "body" });
      await createTask({ title: "mind-2", engine: "mind" });

      const mind = await listTasksByEngine("mind");
      expect(mind).toHaveLength(2);
      expect(mind.map((t) => t.title)).toEqual(["mind-1", "mind-2"]);
    });

    test("scopes reads and deletes to the current user", async () => {
      const firstUserTask = await createTask({ title: "u1 task", engine: "mind" });

      (globalThis as { __testUserId?: string }).__testUserId = "u2";
      const secondUserTask = await createTask({ title: "u2 task", engine: "body" });

      expect((await listTasks()).map((t) => t.id)).toEqual([secondUserTask.id]);

      await deleteTask(firstUserTask.id);
      const protectedRow = _testDb()
        .prepare("SELECT _deleted FROM tasks WHERE id = ?")
        .get(firstUserTask.id) as { _deleted: number };
      expect(protectedRow._deleted).toBe(0);

      (globalThis as { __testUserId?: string }).__testUserId = "u1";
      expect((await listTasks()).map((t) => t.id)).toEqual([firstUserTask.id]);
    });
  });

  describe("deleteTask", () => {
    test("soft-deletes (row remains in SQLite with _deleted=1)", async () => {
      await createTask({ title: "doomed", engine: "charisma" });
      await deleteTask("test-id-1");

      const underlying = _testDb()
        .prepare("SELECT _deleted FROM tasks WHERE id = 'test-id-1'")
        .get() as { _deleted: number };
      expect(underlying._deleted).toBe(1);

      expect(await listTasks()).toHaveLength(0);
    });
  });

  describe("toggleCompletion", () => {
    test("first call → adds completion", async () => {
      const t = await createTask({ title: "push ups", engine: "body" });
      const res = await toggleCompletion({
        taskId: t.id,
        dateKey: "2026-04-18",
        engine: "body",
      });
      expect(res.added).toBe(true);
      const completions = await listCompletionsForDate("2026-04-18");
      expect(completions).toHaveLength(1);
      expect(completions[0].task_id).toBe(t.id);
    });

    test("second call → removes completion", async () => {
      const t = await createTask({ title: "push ups", engine: "body" });
      await toggleCompletion({
        taskId: t.id,
        dateKey: "2026-04-18",
        engine: "body",
      });
      const res = await toggleCompletion({
        taskId: t.id,
        dateKey: "2026-04-18",
        engine: "body",
      });
      expect(res.added).toBe(false);
      expect(await listCompletionsForDate("2026-04-18")).toHaveLength(0);
    });

    test("different dates are independent", async () => {
      const t = await createTask({ title: "push ups", engine: "body" });
      await toggleCompletion({
        taskId: t.id,
        dateKey: "2026-04-18",
        engine: "body",
      });
      await toggleCompletion({
        taskId: t.id,
        dateKey: "2026-04-19",
        engine: "body",
      });
      expect(await listCompletionsForDate("2026-04-18")).toHaveLength(1);
      expect(await listCompletionsForDate("2026-04-19")).toHaveLength(1);
    });
  });

  describe("toggleCompletionAndAward — atomic toggle + XP", () => {
    function readProfile(userId: string) {
      return _testDb()
        .prepare("SELECT xp, level FROM profiles WHERE id = ?")
        .get(userId) as { xp: number; level: number } | undefined;
    }

    test("first toggle inserts the completion AND credits XP in one tx", async () => {
      const t = await createTask({ title: "x", engine: "body" });
      const res = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      expect(res.added).toBe(true);
      expect(res.xp).toBe(20);
      expect(readProfile("u1")?.xp).toBe(20);
      expect(await listCompletionsForDate("2026-04-23")).toHaveLength(1);
    });

    test("second toggle removes the completion AND debits XP", async () => {
      const t = await createTask({ title: "x", engine: "body" });
      await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      const res = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      expect(res.added).toBe(false);
      expect(res.xp).toBe(0);
      expect(readProfile("u1")?.xp).toBe(0);
      expect(await listCompletionsForDate("2026-04-23")).toHaveLength(0);
    });

    test("XP cannot go below zero on un-toggle (clamps at 0)", async () => {
      // Pre-existing 5 XP in profile (less than the un-toggle subtraction).
      _testDb()
        .prepare(
          "INSERT INTO profiles (id, email, xp, level, focus_engines) VALUES (?, ?, ?, ?, ?)",
        )
        .run("u1", null, 5, 1, "[]");

      const t = await createTask({ title: "x", engine: "body" });
      // Insert a completion directly so the next call is a "remove + debit".
      _testDb()
        .prepare(
          "INSERT INTO completions (id, user_id, task_id, engine, date_key) VALUES (?, ?, ?, ?, ?)",
        )
        .run("c1", "u1", t.id, "body", "2026-04-23");

      const res = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      expect(res.added).toBe(false);
      expect(res.xp).toBe(0); // Math.max(0, 5 - 20)
      expect(readProfile("u1")?.xp).toBe(0);
    });

    test("level up is reported when XP crosses a 500-XP threshold", async () => {
      _testDb()
        .prepare(
          "INSERT INTO profiles (id, email, xp, level, focus_engines) VALUES (?, ?, ?, ?, ?)",
        )
        .run("u1", null, 490, 1, "[]");
      const t = await createTask({ title: "x", engine: "body" });
      const res = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      expect(res.leveledUp).toBe(true);
      expect(res.fromLevel).toBe(1);
      expect(res.toLevel).toBe(2);
      expect(readProfile("u1")?.level).toBe(2);
    });

    test("toggle on/off/on leaves the unique-index intact (no orphan row)", async () => {
      const t = await createTask({ title: "x", engine: "body" });
      // Three sequential calls — the first adds, second removes, third
      // adds again. The third would fail the
      // `uq_completions_task_date WHERE _deleted=0` index if the second
      // had left a stale row behind. (The Promise.all-style race
      // against expo-sqlite's serialised writer is real in production
      // but can't be modelled by the in-memory better-sqlite3 fake —
      // single-threaded, no internal queueing — so we pin the
      // sequential consistency that the production atomicity rests on.)
      const a = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      const b = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      const c = await toggleCompletionAndAward({
        taskId: t.id,
        dateKey: "2026-04-23",
        engine: "body",
        xpAmount: 20,
      });
      expect(a.added).toBe(true);
      expect(b.added).toBe(false);
      expect(c.added).toBe(true);
      expect(await listCompletionsForDate("2026-04-23")).toHaveLength(1);
      expect(readProfile("u1")?.xp).toBe(20);
    });
  });

  describe("computeEngineScore", () => {
    test("returns 0 when no active tasks", () => {
      expect(computeEngineScore([], [], "mind")).toBe(0);
    });

    test("weights main (70%) vs secondary (30%)", () => {
      const tasks = [
        {
          id: "m1",
          user_id: "u1",
          title: "Main 1",
          engine: "mind" as const,
          kind: "main" as const,
          is_active: true,
          days_per_week: 7,
          legacy_local_id: null,
          created_at: "",
          updated_at: "",
        },
        {
          id: "s1",
          user_id: "u1",
          title: "Side 1",
          engine: "mind" as const,
          kind: "secondary" as const,
          is_active: true,
          days_per_week: 7,
          legacy_local_id: null,
          created_at: "",
          updated_at: "",
        },
      ];
      expect(computeEngineScore(tasks, [{ task_id: "m1" } as never], "mind")).toBe(
        70,
      );
      expect(computeEngineScore(tasks, [{ task_id: "s1" } as never], "mind")).toBe(
        30,
      );
      expect(
        computeEngineScore(
          tasks,
          [{ task_id: "m1" } as never, { task_id: "s1" } as never],
          "mind",
        ),
      ).toBe(100);
    });
  });
});