/**
 * End-to-end round-trip:
 *   local service writes → outbox → push → supabase
 *   (simulate remote state change) → pull → local converges
 *
 * Verifies the data-flow without any React / component layer.
 */

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
import { pushAll, pushBatch } from "../../sync/push";
import { pullTable } from "../../sync/pull";
import { enqueueDelete, enqueueUpsert, countPending } from "../../sync/outbox";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMod = require("../../lib/supabase") as {
  __fake: ReturnType<typeof import("../setup/supabase-fake").makeSupabaseFake>;
};
const fake = supabaseMod.__fake;

describe("round-trip: local mutation → push → remote change → pull", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("create task locally → push sends it → _dirty clears", async () => {
    // 1. Simulate a service-layer create: INSERT + enqueueUpsert.
    _testDb()
      .prepare(
        `INSERT INTO tasks
           (id, user_id, title, engine, kind, is_active, days_per_week,
            created_at, updated_at, _dirty, _deleted)
         VALUES ('t1', 'u1', 'Read', 'mind', 'main', 1, 7,
                 datetime('now'), datetime('now'), 1, 0)`,
      )
      .run();
    await enqueueUpsert("tasks", {
      id: "t1",
      user_id: "u1",
      title: "Read",
      engine: "mind",
      kind: "main",
      is_active: true,
      days_per_week: 7,
      created_at: "2026-04-18T00:00:00Z",
      updated_at: "2026-04-18T00:00:00Z",
    });
    expect(await countPending()).toBe(1);

    // 2. Push.
    const pushRes = await pushAll();
    expect(pushRes.pushed).toBe(1);
    expect(pushRes.stopReason).toBe("empty");

    // 3. Verify.
    expect(await countPending()).toBe(0);
    const row = _testDb()
      .prepare("SELECT _dirty FROM tasks WHERE id = 't1'")
      .get() as { _dirty: number };
    expect(row._dirty).toBe(0);
    // And the upsert call carries the right payload (no sync cols).
    const upsertCall = fake.state.calls.find((c) => c.method === "upsert");
    expect(upsertCall?.upsert?.payload).toMatchObject({
      id: "t1",
      title: "Read",
      is_active: true,
    });
    expect(upsertCall?.upsert?.payload).not.toHaveProperty("_dirty");
  });

  test("pull merges a remote-changed row into local clean state", async () => {
    // Start with a local clean task.
    _testDb()
      .prepare(
        `INSERT INTO tasks
           (id, user_id, title, engine, kind, is_active, days_per_week,
            created_at, updated_at, _dirty, _deleted)
         VALUES ('t1', 'u1', 'Original', 'mind', 'main', 1, 7,
                 datetime('now'), '2026-04-17T00:00:00Z', 0, 0)`,
      )
      .run();

    // Remote now has a newer version.
    fake.state.setSelectData("tasks", [
      {
        id: "t1",
        user_id: "u1",
        title: "Edited from Device B",
        engine: "mind",
        kind: "main",
        is_active: true,
        days_per_week: 7,
        created_at: "2026-04-18T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
      },
    ]);

    await pullTable("tasks");

    const row = _testDb()
      .prepare("SELECT title, updated_at, _dirty FROM tasks WHERE id = 't1'")
      .get() as { title: string; updated_at: string; _dirty: number };
    expect(row.title).toBe("Edited from Device B");
    expect(row.updated_at).toBe("2026-04-19T00:00:00Z");
    expect(row._dirty).toBe(0);
  });

  test("soft-delete → push → hard-delete converges", async () => {
    _testDb()
      .prepare(
        `INSERT INTO tasks
           (id, user_id, title, engine, kind, is_active, days_per_week,
            created_at, updated_at, _dirty, _deleted)
         VALUES ('t1', 'u1', 'Dying', 'mind', 'main', 1, 7,
                 datetime('now'), datetime('now'), 0, 0)`,
      )
      .run();

    await enqueueDelete("tasks", { id: "t1" });

    // Between enqueue and push, the row is locally soft-deleted.
    const mid = _testDb()
      .prepare("SELECT _dirty, _deleted FROM tasks WHERE id = 't1'")
      .get() as { _dirty: number; _deleted: number };
    expect(mid).toEqual({ _dirty: 1, _deleted: 1 });

    // Push.
    await pushBatch();

    // After successful push, the row is hard-deleted.
    const after = _testDb()
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE id = 't1'")
      .get() as { c: number };
    expect(after.c).toBe(0);
    expect(await countPending()).toBe(0);
  });

  test("local dirty + remote newer → LWW loses local change but keeps sync consistent", async () => {
    // User made a local change (_dirty=1) at T2 but hasn't pushed yet.
    _testDb()
      .prepare(
        `INSERT INTO tasks
           (id, user_id, title, engine, kind, is_active, days_per_week,
            created_at, updated_at, _dirty, _deleted)
         VALUES ('t1', 'u1', 'Device A edit', 'mind', 'main', 1, 7,
                 datetime('now'), '2026-04-18T00:00:00Z', 1, 0)`,
      )
      .run();
    await enqueueUpsert("tasks", {
      id: "t1",
      user_id: "u1",
      title: "Device A edit",
      engine: "mind",
      kind: "main",
      is_active: true,
      updated_at: "2026-04-18T00:00:00Z",
    });

    // Meanwhile Device B edited the same row AT A LATER time T3.
    fake.state.setSelectData("tasks", [
      {
        id: "t1",
        user_id: "u1",
        title: "Device B wins",
        engine: "mind",
        kind: "main",
        is_active: true,
        created_at: "2026-04-17T00:00:00Z",
        updated_at: "2026-04-19T00:00:00Z",
      },
    ]);

    // Pull runs; LWW sees remote is newer than local dirty.
    const pullRes = await pullTable("tasks");
    expect(pullRes.pulled).toBe(1);

    const row = _testDb()
      .prepare("SELECT title, _dirty FROM tasks WHERE id = 't1'")
      .get() as { title: string; _dirty: number };
    expect(row.title).toBe("Device B wins");
    expect(row._dirty).toBe(0);
  });

  test("json column round-trips: array stays array end-to-end", async () => {
    _testDb()
      .prepare(
        `INSERT INTO boss_challenges
           (id, user_id, boss_id, started_at, progress, days_required,
            evaluator_type, day_results, status, updated_at, _dirty, _deleted)
         VALUES ('b1', 'u1', 'boss_1', datetime('now'), 2, 7,
                 'habit_streak', '[true, false, true]', 'active',
                 '2026-04-18T00:00:00Z', 1, 0)`,
      )
      .run();

    await enqueueUpsert("boss_challenges", {
      id: "b1",
      user_id: "u1",
      boss_id: "boss_1",
      started_at: "2026-04-15T00:00:00Z",
      progress: 2,
      days_required: 7,
      evaluator_type: "habit_streak",
      day_results: [true, false, true],
      status: "active",
      resolved_at: null,
      updated_at: "2026-04-18T00:00:00Z",
    });

    await pushBatch();

    const call = fake.state.calls.find((c) => c.method === "upsert");
    // Payload must carry day_results as a real array (Supabase will
    // serialize it into jsonb).
    expect(call?.upsert?.payload.day_results).toEqual([true, false, true]);

    // Now simulate remote edit: day_results = [true,true,true]
    fake.state.setSelectData("boss_challenges", [
      {
        id: "b1",
        user_id: "u1",
        boss_id: "boss_1",
        started_at: "2026-04-15T00:00:00Z",
        progress: 3,
        days_required: 7,
        evaluator_type: "habit_streak",
        day_results: [true, true, true],
        status: "active",
        resolved_at: null,
        updated_at: "2026-04-19T00:00:00Z",
      },
    ]);
    await pullTable("boss_challenges");

    const row = _testDb()
      .prepare("SELECT day_results FROM boss_challenges WHERE id = 'b1'")
      .get() as { day_results: string };
    expect(JSON.parse(row.day_results)).toEqual([true, true, true]);
  });
});
