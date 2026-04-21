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
  requireUserId: async () => "u1",
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
  computeEngineScore,
} from "../../services/tasks";

describe("tasks service", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
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
