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
import {
  hasSeeded,
  initialSeed,
  resetLocalDataForUserSwitch,
} from "../../sync/seed";
import { PULL_ORDER } from "../../sync/tables";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMod = require("../../lib/supabase") as {
  __fake: ReturnType<typeof import("../setup/supabase-fake").makeSupabaseFake>;
};
const fake = supabaseMod.__fake;

describe("hasSeeded", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("returns false on a fresh DB", async () => {
    expect(await hasSeeded()).toBe(false);
  });

  test("returns true once sync_meta has a row", async () => {
    _testDb()
      .prepare(
        `INSERT INTO sync_meta (table_name, last_pulled_at) VALUES ('tasks', 'now')`,
      )
      .run();
    expect(await hasSeeded()).toBe(true);
  });
});

describe("initialSeed", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("iterates every table in PULL_ORDER and reports progress", async () => {
    const progress: Array<{ table: string | null; completed: number }> = [];
    const res = await initialSeed((p) =>
      progress.push({
        table: p.currentTable,
        completed: p.tablesCompleted,
      }),
    );
    expect(res.success).toBe(true);
    // First callback fires before the first pull (0 completed).
    expect(progress[0].completed).toBe(0);
    // Last callback fires after all tables complete.
    expect(progress[progress.length - 1]).toEqual({
      table: null,
      completed: PULL_ORDER.length,
    });

    // Every table saw a select call.
    for (const t of PULL_ORDER) {
      const calls = fake.state.calls.filter(
        (c) => c.method === "select" && c.table === t,
      );
      expect(calls.length).toBeGreaterThanOrEqual(1);
    }
  });

  test("aborts on auth error and reports failing table", async () => {
    fake.state.setSelectError("habits", { status: 401 });
    const res = await initialSeed();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("auth");
      expect(res.errorTable).toBe("habits");
    }
  });

  test("aborts on transient error and reports table", async () => {
    fake.state.setSelectError("tasks", { status: 500, message: "db down" });
    const res = await initialSeed();
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error).toBe("db down");
      expect(res.errorTable).toBe("tasks");
    }
  });
});

describe("resetLocalDataForUserSwitch", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("deletes every row from synced tables and sync_meta", async () => {
    _testDb()
      .prepare(
        `INSERT INTO tasks (id, user_id, title, engine, kind, is_active, days_per_week, created_at, updated_at)
         VALUES ('t1', 'u1', 'A', 'mind', 'main', 1, 7, datetime('now'), datetime('now'))`,
      )
      .run();
    _testDb()
      .prepare(
        `INSERT INTO sync_meta (table_name, last_pulled_at) VALUES ('tasks', 'x')`,
      )
      .run();

    await resetLocalDataForUserSwitch();

    const tasksCount = _testDb()
      .prepare("SELECT COUNT(*) AS c FROM tasks")
      .get() as { c: number };
    const metaCount = _testDb()
      .prepare("SELECT COUNT(*) AS c FROM sync_meta")
      .get() as { c: number };
    const migrationsCount = _testDb()
      .prepare("SELECT COUNT(*) AS c FROM schema_migrations")
      .get() as { c: number };

    expect(tasksCount.c).toBe(0);
    expect(metaCount.c).toBe(0);
    // schema_migrations preserved
    expect(migrationsCount.c).toBeGreaterThan(0);
  });
});
