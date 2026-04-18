jest.mock("../../db/sqlite/client", () =>
  require("../setup/sqlite-fake"),
);
jest.mock("../../lib/supabase", () => {
  const { makeSupabaseFake } = require("../setup/supabase-fake");
  const fake = makeSupabaseFake();
  return {
    supabase: fake.supabase,
    requireUserId: async () => "u1",
    ensureProfileRow: async () => {},
    __fake: fake,
  };
});
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import { pullAll, pullTable, readCursor } from "../../sync/pull";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMod = require("../../lib/supabase") as {
  __fake: ReturnType<typeof import("../setup/supabase-fake").makeSupabaseFake>;
};
const fake = supabaseMod.__fake;

const TS_OLDER = "2026-04-17T00:00:00.000Z";
const TS_MID = "2026-04-18T00:00:00.000Z";
const TS_NEWER = "2026-04-19T00:00:00.000Z";

function insertLocalTask(row: {
  id: string;
  dirty?: 0 | 1;
  deleted?: 0 | 1;
  updated_at?: string;
  title?: string;
}) {
  _testDb()
    .prepare(
      `INSERT INTO tasks
         (id, user_id, title, engine, kind, is_active, days_per_week,
          created_at, updated_at, _dirty, _deleted)
       VALUES (?, 'u1', ?, 'mind', 'main', 1, 7,
               datetime('now'), ?, ?, ?)`,
    )
    .run(
      row.id,
      row.title ?? "Local title",
      row.updated_at ?? TS_MID,
      row.dirty ?? 0,
      row.deleted ?? 0,
    );
}

function remoteTaskRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: "t1",
    user_id: "u1",
    title: "Remote title",
    engine: "mind",
    kind: "main",
    is_active: true,
    days_per_week: 7,
    created_at: TS_MID,
    updated_at: TS_MID,
    ...overrides,
  };
}

describe("pullTable", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("empty remote → returns complete with 0 pulled", async () => {
    fake.state.setSelectData("tasks", []);
    const res = await pullTable("tasks");
    expect(res.stopReason).toBe("complete");
    expect(res.pulled).toBe(0);
    // Cursor NOT written when no rows came in.
    expect(await readCursor("tasks")).toBeNull();
  });

  test("inserts remote rows with _dirty=0, _deleted=0", async () => {
    fake.state.setSelectData("tasks", [
      remoteTaskRow({ id: "t1", title: "From remote", updated_at: TS_MID }),
      remoteTaskRow({ id: "t2", title: "Also remote", updated_at: TS_NEWER }),
    ]);
    const res = await pullTable("tasks");
    expect(res.pulled).toBe(2);
    expect(res.skippedDirty).toBe(0);

    const rows = _testDb()
      .prepare("SELECT id, title, _dirty, _deleted FROM tasks ORDER BY id")
      .all() as Array<{ id: string; title: string; _dirty: number; _deleted: number }>;
    expect(rows).toEqual([
      { id: "t1", title: "From remote", _dirty: 0, _deleted: 0 },
      { id: "t2", title: "Also remote", _dirty: 0, _deleted: 0 },
    ]);
  });

  test("advances cursor to max updated_at seen", async () => {
    fake.state.setSelectData("tasks", [
      remoteTaskRow({ id: "t1", updated_at: TS_OLDER }),
      remoteTaskRow({ id: "t2", updated_at: TS_NEWER }),
    ]);
    await pullTable("tasks");
    expect(await readCursor("tasks")).toBe(TS_NEWER);
  });

  test("subsequent pull uses cursor as gt() filter", async () => {
    fake.state.setSelectData("tasks", [
      remoteTaskRow({ id: "t1", updated_at: TS_MID }),
    ]);
    await pullTable("tasks");
    fake.state.reset();
    fake.state.setSelectData("tasks", []);
    await pullTable("tasks");

    const selectCall = fake.state.calls.find((c) => c.method === "select");
    expect(selectCall?.select?.cursorCol).toBe("updated_at");
    expect(selectCall?.select?.cursorVal).toBe(TS_MID);
  });

  test("coerces boolean columns on insert (is_active → 1)", async () => {
    fake.state.setSelectData("tasks", [
      remoteTaskRow({ id: "t1", is_active: true }),
    ]);
    await pullTable("tasks");
    const row = _testDb()
      .prepare("SELECT is_active FROM tasks WHERE id = 't1'")
      .get() as { is_active: number };
    expect(row.is_active).toBe(1);
  });

  test("stringifies JSON columns on insert", async () => {
    // boss_challenges has day_results json
    fake.state.setSelectData("boss_challenges", [
      {
        id: "b1",
        user_id: "u1",
        boss_id: "boss_1",
        started_at: TS_MID,
        progress: 2,
        days_required: 7,
        evaluator_type: "habit_streak",
        day_results: [true, false, true],
        status: "active",
        resolved_at: null,
        updated_at: TS_MID,
      },
    ]);
    await pullTable("boss_challenges");
    const row = _testDb()
      .prepare("SELECT day_results FROM boss_challenges WHERE id = 'b1'")
      .get() as { day_results: string };
    expect(typeof row.day_results).toBe("string");
    expect(JSON.parse(row.day_results)).toEqual([true, false, true]);
  });

  describe("LWW", () => {
    test("local clean + remote newer → remote wins", async () => {
      insertLocalTask({ id: "t1", title: "Old local", updated_at: TS_OLDER });
      fake.state.setSelectData("tasks", [
        remoteTaskRow({
          id: "t1",
          title: "Newer remote",
          updated_at: TS_NEWER,
        }),
      ]);
      await pullTable("tasks");
      const row = _testDb()
        .prepare("SELECT title, _dirty FROM tasks WHERE id = 't1'")
        .get() as { title: string; _dirty: number };
      expect(row.title).toBe("Newer remote");
      expect(row._dirty).toBe(0);
    });

    test("local dirty + local newer → skip remote", async () => {
      insertLocalTask({
        id: "t1",
        title: "Newer local",
        updated_at: TS_NEWER,
        dirty: 1,
      });
      fake.state.setSelectData("tasks", [
        remoteTaskRow({
          id: "t1",
          title: "Older remote",
          updated_at: TS_OLDER,
        }),
      ]);
      const res = await pullTable("tasks");
      expect(res.skippedDirty).toBe(1);
      expect(res.pulled).toBe(0);

      const row = _testDb()
        .prepare("SELECT title, _dirty FROM tasks WHERE id = 't1'")
        .get() as { title: string; _dirty: number };
      expect(row.title).toBe("Newer local");
      expect(row._dirty).toBe(1);
    });

    test("local dirty + remote newer → remote wins (LWW overwrite)", async () => {
      insertLocalTask({
        id: "t1",
        title: "Older local dirty",
        updated_at: TS_OLDER,
        dirty: 1,
      });
      fake.state.setSelectData("tasks", [
        remoteTaskRow({
          id: "t1",
          title: "Newer remote",
          updated_at: TS_NEWER,
        }),
      ]);
      const res = await pullTable("tasks");
      expect(res.pulled).toBe(1);
      const row = _testDb()
        .prepare("SELECT title, _dirty FROM tasks WHERE id = 't1'")
        .get() as { title: string; _dirty: number };
      expect(row.title).toBe("Newer remote");
      expect(row._dirty).toBe(0);
    });

    test("local pending delete → skip remote (don't resurrect)", async () => {
      insertLocalTask({
        id: "t1",
        title: "Tombstoned",
        dirty: 1,
        deleted: 1,
      });
      fake.state.setSelectData("tasks", [
        remoteTaskRow({
          id: "t1",
          title: "Still on remote",
          updated_at: TS_NEWER,
        }),
      ]);
      const res = await pullTable("tasks");
      expect(res.skippedDirty).toBe(1);
      expect(res.pulled).toBe(0);
      const row = _testDb()
        .prepare("SELECT _deleted FROM tasks WHERE id = 't1'")
        .get() as { _deleted: number };
      expect(row._deleted).toBe(1);
    });
  });

  describe("error handling", () => {
    test("auth error → stopReason 'auth'", async () => {
      fake.state.setSelectError("tasks", { status: 401 });
      const res = await pullTable("tasks");
      expect(res.stopReason).toBe("auth");
    });

    test("transient error → stopReason 'transient'", async () => {
      fake.state.setSelectError("tasks", { status: 500, message: "boom" });
      const res = await pullTable("tasks");
      expect(res.stopReason).toBe("transient");
    });
  });

  test("composite-PK table pulls into right row (srs_cards)", async () => {
    fake.state.setSelectData("srs_cards", [
      {
        user_id: "u1",
        exercise_id: "e1",
        interval_days: 3,
        ease_factor: 2.5,
        review_count: 0,
        next_review_at: TS_MID,
        updated_at: TS_MID,
      },
    ]);
    await pullTable("srs_cards");
    const row = _testDb()
      .prepare(
        `SELECT interval_days FROM srs_cards WHERE user_id = 'u1' AND exercise_id = 'e1'`,
      )
      .get() as { interval_days: number };
    expect(row.interval_days).toBe(3);
  });
});

describe("pullAll", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("iterates all tables in order; aborts on auth", async () => {
    fake.state.setSelectData("tasks", [
      remoteTaskRow({ id: "t1", updated_at: TS_MID }),
    ]);
    fake.state.setSelectError("habits", { status: 401 });

    const res = await pullAll(["tasks", "habits", "budgets"]);
    expect(res.stopReason).toBe("auth");
    // tasks was pulled before the auth error on habits
    const rowCount = _testDb()
      .prepare("SELECT COUNT(*) AS c FROM tasks")
      .get() as { c: number };
    expect(rowCount.c).toBe(1);
    // budgets was never reached
    const budgetCalls = fake.state.calls.filter((c) => c.table === "budgets");
    expect(budgetCalls).toHaveLength(0);
  });

  test("fullRefresh: ignores existing cursor", async () => {
    // Seed a cursor
    _testDb()
      .prepare(
        `INSERT INTO sync_meta (table_name, last_pulled_at) VALUES ('tasks', ?)`,
      )
      .run(TS_NEWER);

    fake.state.setSelectData("tasks", []);
    await pullTable("tasks", { fullRefresh: true });
    // With fullRefresh, no gt() cursor is applied.
    const selectCall = fake.state.calls.find((c) => c.method === "select");
    expect(selectCall?.select?.cursorVal).toBeUndefined();
  });
});
