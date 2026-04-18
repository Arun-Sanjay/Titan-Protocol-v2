/**
 * Integration tests for src/services/tasks.ts.
 *
 * Uses the in-memory SQLite shim. Mocks expo-crypto's randomUUID so ids
 * are deterministic. Mocks the sync engine's `scheduleMutationPush` so
 * we don't load react-native / netinfo transitively.
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u1",
  ensureProfileRow: async () => {},
}));
jest.mock("../../sync/engine", () => ({
  scheduleMutationPush: jest.fn(),
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));

// expo-crypto is native; replace with a deterministic id generator. The
// counter lives on `global` so jest's hoisted factory can reach it without
// tripping the "out-of-scope variables" check.
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
import { countPending, listPending } from "../../sync/outbox";

describe("tasks service", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  describe("createTask", () => {
    test("inserts into SQLite with _dirty=1 and enqueues an upsert", async () => {
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

      expect(await countPending()).toBe(1);
      const [pending] = await listPending();
      expect(pending.op).toBe("upsert");
      expect(pending.table_name).toBe("tasks");
    });

    test("returns JS-typed row (boolean not 0/1)", async () => {
      const row = await createTask({
        title: "x",
        engine: "body",
      });
      // Booleans are TRUE bools, not 0/1 — otherwise downstream `? :` would break.
      expect(typeof row.is_active).toBe("boolean");
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
    test("soft-deletes locally and enqueues a delete mutation", async () => {
      await createTask({ title: "doomed", engine: "charisma" });
      await deleteTask("test-id-1");

      // Local row carries the tombstone but hasn't been hard-deleted yet.
      const underlying = _testDb()
        .prepare("SELECT _deleted, _dirty FROM tasks WHERE id = 'test-id-1'")
        .get() as { _deleted: number; _dirty: number };
      expect(underlying).toEqual({ _deleted: 1, _dirty: 1 });

      // Service read filters out _deleted=1 rows.
      expect(await listTasks()).toHaveLength(0);

      // One delete mutation enqueued.
      const [pending] = await listPending();
      expect(pending.op).toBe("delete");
      expect(pending.row_id).toBe("test-id-1");
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
      const completions = await listCompletionsForDate("2026-04-18");
      expect(completions).toHaveLength(0);
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
      // Only main done → 70% score
      expect(computeEngineScore(tasks, [{ task_id: "m1" } as never], "mind")).toBe(
        70,
      );
      // Only side done → 30%
      expect(computeEngineScore(tasks, [{ task_id: "s1" } as never], "mind")).toBe(
        30,
      );
      // Both → 100
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
