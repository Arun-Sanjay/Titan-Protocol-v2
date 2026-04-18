/**
 * Push-loop tests. Mocks:
 *   - src/db/sqlite/client → in-memory better-sqlite3
 *   - src/lib/supabase     → a chainable fake exposed via `__fake`
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
// logError would try to talk to native — stub.
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));

import { _resetTestDb } from "../setup/sqlite-fake";
import { pushBatch, pushAll } from "../../sync/push";
import { enqueueDelete, enqueueUpsert, listPending, countPending } from "../../sync/outbox";
import { MAX_ATTEMPTS } from "../../sync/backoff";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const supabaseMod = require("../../lib/supabase") as {
  __fake: ReturnType<typeof import("../setup/supabase-fake").makeSupabaseFake>;
};
const fake = supabaseMod.__fake;

function insertTask(row: {
  id: string;
  user_id: string;
  title?: string;
  engine?: string;
  dirty?: 0 | 1;
  deleted?: 0 | 1;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { _testDb } = require("../setup/sqlite-fake");
  _testDb()
    .prepare(
      `INSERT INTO tasks
        (id, user_id, title, engine, kind, is_active, days_per_week,
         created_at, updated_at, _dirty, _deleted)
       VALUES (?, ?, ?, ?, 'main', 1, 7,
               datetime('now'), datetime('now'), ?, ?)`,
    )
    .run(
      row.id,
      row.user_id,
      row.title ?? "Read",
      row.engine ?? "mind",
      row.dirty ?? 1,
      row.deleted ?? 0,
    );
}

async function enqueueTaskUpsert(id: string) {
  insertTask({ id, user_id: "u1" });
  await enqueueUpsert("tasks", {
    id,
    user_id: "u1",
    title: "Read",
    engine: "mind",
    kind: "main",
    is_active: true,
  });
}

describe("pushBatch", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("drains a clean outbox without touching Supabase when empty", async () => {
    const res = await pushBatch();
    expect(res.stopReason).toBe("empty");
    expect(res.pushed).toBe(0);
    expect(fake.state.calls).toHaveLength(0);
  });

  test("pushes upserts to Supabase and clears _dirty locally on success", async () => {
    await enqueueTaskUpsert("t1");
    const res = await pushBatch();

    expect(res.pushed).toBe(1);
    expect(res.failed).toBe(0);
    expect(res.stopReason).toBe("batch_done");
    expect(fake.state.calls).toHaveLength(1);
    expect(fake.state.calls[0]).toMatchObject({
      method: "upsert",
      table: "tasks",
    });
    // Payload must NOT include _dirty / _deleted.
    const upsertCall = fake.state.calls[0];
    expect(upsertCall.upsert?.payload).not.toHaveProperty("_dirty");
    expect(upsertCall.upsert?.payload).not.toHaveProperty("_deleted");
    // onConflict matches PK.
    expect(upsertCall.upsert?.onConflict).toBe("id");

    // Outbox is empty + row _dirty=0.
    expect(await countPending()).toBe(0);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { _testDb } = require("../setup/sqlite-fake");
    const row = _testDb()
      .prepare("SELECT _dirty FROM tasks WHERE id = 't1'")
      .get() as { _dirty: number };
    expect(row._dirty).toBe(0);
  });

  test("pushes deletes to Supabase with eq() conditions matching PK", async () => {
    insertTask({ id: "t1", user_id: "u1" });
    await enqueueDelete("tasks", { id: "t1" });

    const res = await pushBatch();
    expect(res.pushed).toBe(1);
    expect(fake.state.calls[0]).toMatchObject({
      method: "delete",
      table: "tasks",
      delete: { conditions: [["id", "t1"]] },
    });

    // Row hard-deleted after successful remote delete.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { _testDb } = require("../setup/sqlite-fake");
    const row = _testDb()
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE id = 't1'")
      .get() as { c: number };
    expect(row.c).toBe(0);
  });

  test("transient error: marks mutation failed with backoff, keeps outbox", async () => {
    await enqueueTaskUpsert("t1");
    fake.state.setUpsertError("tasks", { status: 500, message: "server down" });

    const res = await pushBatch();
    expect(res.pushed).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.stopReason).toBe("batch_done");

    // Mutation still present with attempts=1
    const pending = await listPending(1);
    expect(pending).toHaveLength(0); // next_attempt is now in the future → excluded
    expect(await countPending()).toBe(1);
  });

  test("auth error: stops immediately (bails the cycle)", async () => {
    await enqueueTaskUpsert("t1");
    await enqueueTaskUpsert("t2");
    fake.state.setUpsertError("tasks", { status: 401 });

    const res = await pushBatch();
    expect(res.stopReason).toBe("auth");
    expect(res.pushed).toBe(0);
    // Second mutation never attempted.
    expect(fake.state.calls).toHaveLength(1);
  });

  test("fatal error: drops the mutation and continues", async () => {
    // Use two different tables so per-table errors don't collide:
    //   tasks     → fatal (400) → dropped
    //   budgets   → no error   → pushed successfully
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { _testDb } = require("../setup/sqlite-fake");
    _testDb()
      .prepare(
        `INSERT INTO budgets (id, user_id, category, monthly_limit, created_at, updated_at)
         VALUES ('b1', 'u1', 'food', 500, datetime('now'), datetime('now'))`,
      )
      .run();

    await enqueueTaskUpsert("t1");
    await enqueueUpsert("budgets", {
      id: "b1",
      user_id: "u1",
      category: "food",
      monthly_limit: 500,
      created_at: "2026-04-18T00:00:00Z",
      updated_at: "2026-04-18T00:00:00Z",
    });

    fake.state.setUpsertError("tasks", { status: 400, message: "bad body" });
    // budgets has no error set → succeeds.

    const res = await pushBatch();
    expect(res.pushed).toBe(1); // budgets went through
    expect(res.failed).toBe(1); // tasks dropped
    expect(await countPending()).toBe(0); // both gone from outbox
  });

  test("conflict error: mutation stays in outbox with bumped attempts", async () => {
    await enqueueTaskUpsert("t1");
    fake.state.setUpsertError("tasks", { status: 409 });

    await pushBatch();
    // Still present; attempts bumped but under the cap so it'll retry after backoff.
    expect(await countPending()).toBe(1);
  });

  test("composite-PK upsert passes onConflict with all pk cols", async () => {
    // srs_cards has PK (user_id, exercise_id)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { _testDb } = require("../setup/sqlite-fake");
    _testDb()
      .prepare(
        `INSERT INTO srs_cards (user_id, exercise_id, updated_at)
         VALUES ('u1', 'e1', datetime('now'))`,
      )
      .run();

    await enqueueUpsert("srs_cards", {
      user_id: "u1",
      exercise_id: "e1",
      interval_days: 3,
      ease_factor: 2.5,
      review_count: 0,
      next_review_at: "2026-04-20",
      updated_at: "2026-04-18T00:00:00Z",
    });

    const res = await pushBatch();
    expect(res.pushed).toBe(1);
    expect(fake.state.calls[0].upsert?.onConflict).toBe("user_id,exercise_id");
  });
});

describe("pushAll", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("drains multiple batches until empty", async () => {
    // 25 mutations; batch limit is 20 → two rounds
    for (let i = 0; i < 25; i++) {
      await enqueueTaskUpsert(`t${i}`);
    }
    const res = await pushAll();
    expect(res.pushed).toBe(25);
    expect(res.stopReason).toBe("empty");
  });

  test("stops on auth error even with many mutations pending", async () => {
    for (let i = 0; i < 5; i++) await enqueueTaskUpsert(`t${i}`);
    fake.state.setUpsertError("tasks", { status: 401 });
    const res = await pushAll();
    expect(res.stopReason).toBe("auth");
    expect(res.pushed).toBe(0);
    // 4 pushed to network before bail? No — auth is caught and stops.
    // Only first attempt made (then bail).
    expect(fake.state.calls).toHaveLength(1);
  });
});

describe("stuck-mutation cap", () => {
  beforeEach(() => {
    _resetTestDb();
    fake.state.reset();
  });

  test("mutations at MAX_ATTEMPTS are not included in pushBatch", async () => {
    await enqueueTaskUpsert("t1");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { _testDb } = require("../setup/sqlite-fake");
    _testDb()
      .prepare(`UPDATE pending_mutations SET attempts = ?`)
      .run(MAX_ATTEMPTS);
    const res = await pushBatch();
    expect(res.stopReason).toBe("empty");
  });
});
