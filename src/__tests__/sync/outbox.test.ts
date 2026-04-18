jest.mock("../../db/sqlite/client", () =>
  require("../setup/sqlite-fake"),
);

import {
  _resetTestDb,
  _testDb,
} from "../setup/sqlite-fake";
import {
  countPending,
  countStuck,
  deleteMutation,
  enqueueDelete,
  enqueueUpsert,
  listPending,
  markFailed,
  markPushed,
  resetMutation,
} from "../../sync/outbox";
import { MAX_ATTEMPTS } from "../../sync/backoff";

function insertTask(row: {
  id: string;
  user_id: string;
  title: string;
  engine: string;
  is_active?: 0 | 1;
  dirty?: 0 | 1;
  deleted?: 0 | 1;
  updated_at?: string;
}) {
  _testDb()
    .prepare(
      `INSERT INTO tasks
         (id, user_id, title, engine, kind, is_active, days_per_week,
          created_at, updated_at, _dirty, _deleted)
       VALUES (@id, @user_id, @title, @engine, 'main', @is_active, 7,
               datetime('now'), @updated_at, @dirty, @deleted)`,
    )
    .run({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      engine: row.engine,
      is_active: row.is_active ?? 1,
      dirty: row.dirty ?? 0,
      deleted: row.deleted ?? 0,
      updated_at: row.updated_at ?? new Date().toISOString(),
    });
}

describe("outbox", () => {
  beforeEach(() => {
    _resetTestDb();
  });

  describe("enqueueUpsert", () => {
    test("inserts a mutation with op='upsert' and payload = row JSON", async () => {
      const row = {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
        days_per_week: 7,
        created_at: "2026-04-18T00:00:00Z",
        updated_at: "2026-04-18T00:00:00Z",
      };
      await enqueueUpsert("tasks", row);

      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].table_name).toBe("tasks");
      expect(pending[0].op).toBe("upsert");
      expect(pending[0].row_id).toBe("t1");
      expect(pending[0].attempts).toBe(0);

      const payload = JSON.parse(pending[0].payload);
      expect(payload.title).toBe("Read");
      // JS-typed: boolean stays as boolean in the outbox payload.
      expect(payload.is_active).toBe(true);
    });

    test("re-enqueueing same (table, row) replaces the mutation", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read more",
        engine: "mind",
        kind: "main",
        is_active: true,
      });

      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(JSON.parse(pending[0].payload).title).toBe("Read more");
    });

    test("clobbers any pending delete for the same row (resurrection)", async () => {
      insertTask({ id: "t1", user_id: "u1", title: "Read", engine: "mind" });
      await enqueueDelete("tasks", { id: "t1" });
      expect(await countPending()).toBe(1);

      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read (resurrected)",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].op).toBe("upsert");
    });
  });

  describe("enqueueDelete", () => {
    test("soft-deletes the row and enqueues op='delete'", async () => {
      insertTask({ id: "t1", user_id: "u1", title: "Read", engine: "mind" });
      await enqueueDelete("tasks", { id: "t1" });

      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].op).toBe("delete");
      expect(pending[0].row_id).toBe("t1");
      expect(JSON.parse(pending[0].payload)).toEqual({ pk: { id: "t1" } });

      const row = _testDb()
        .prepare("SELECT _dirty, _deleted FROM tasks WHERE id = ?")
        .get("t1") as { _dirty: number; _deleted: number };
      expect(row._dirty).toBe(1);
      expect(row._deleted).toBe(1);
    });

    test("clobbers any pending upsert for the same row", async () => {
      insertTask({ id: "t1", user_id: "u1", title: "Read", engine: "mind" });
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      expect(await countPending()).toBe(1);

      await enqueueDelete("tasks", { id: "t1" });
      const pending = await listPending();
      expect(pending).toHaveLength(1);
      expect(pending[0].op).toBe("delete");
    });

    test("handles composite-PK tables", async () => {
      // srs_cards has PK (user_id, exercise_id)
      _testDb()
        .prepare(
          `INSERT INTO srs_cards (user_id, exercise_id, next_review_at, updated_at)
           VALUES ('u1', 'e1', datetime('now'), datetime('now'))`,
        )
        .run();
      await enqueueDelete("srs_cards", { user_id: "u1", exercise_id: "e1" });
      const pending = await listPending();
      expect(pending[0].row_id).toBe("u1/e1");
      expect(JSON.parse(pending[0].payload)).toEqual({
        pk: { user_id: "u1", exercise_id: "e1" },
      });
    });
  });

  describe("listPending", () => {
    test("excludes mutations with future next_attempt", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      // Manually push next_attempt 1 hour into the future.
      _testDb()
        .prepare(
          `UPDATE pending_mutations SET next_attempt = datetime('now','+1 hour')`,
        )
        .run();
      const pending = await listPending();
      expect(pending).toHaveLength(0);
    });

    test("excludes mutations that exceeded MAX_ATTEMPTS", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      _testDb()
        .prepare(`UPDATE pending_mutations SET attempts = ?`)
        .run(MAX_ATTEMPTS);
      expect(await listPending()).toHaveLength(0);
      expect(await countStuck()).toBe(1);
    });

    test("orders by created_at ASC", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "A",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      // Backdate t1's created_at so t2 appears after it.
      _testDb()
        .prepare(
          `UPDATE pending_mutations SET created_at = datetime('now','-1 hour') WHERE row_id='t1'`,
        )
        .run();
      await enqueueUpsert("tasks", {
        id: "t2",
        user_id: "u1",
        title: "B",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      const pending = await listPending();
      expect(pending.map((m) => m.row_id)).toEqual(["t1", "t2"]);
    });
  });

  describe("markPushed", () => {
    test("(upsert) clears _dirty on the row and removes the mutation", async () => {
      insertTask({
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        dirty: 1,
      });
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });

      const [m] = await listPending();
      await markPushed(m);

      expect(await countPending()).toBe(0);
      const row = _testDb()
        .prepare("SELECT _dirty FROM tasks WHERE id = ?")
        .get("t1") as { _dirty: number };
      expect(row._dirty).toBe(0);
    });

    test("(delete) hard-deletes the row and removes the mutation", async () => {
      insertTask({ id: "t1", user_id: "u1", title: "Read", engine: "mind" });
      await enqueueDelete("tasks", { id: "t1" });

      const [m] = await listPending();
      await markPushed(m);

      expect(await countPending()).toBe(0);
      const row = _testDb()
        .prepare("SELECT COUNT(*) AS c FROM tasks WHERE id = ?")
        .get("t1") as { c: number };
      expect(row.c).toBe(0);
    });
  });

  describe("markFailed", () => {
    test("bumps attempts, stores last_error, schedules next_attempt", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      const [m] = await listPending();
      await markFailed(m, "network fail");

      const row = _testDb()
        .prepare("SELECT * FROM pending_mutations WHERE id = ?")
        .get(m.id) as {
        attempts: number;
        last_error: string;
        next_attempt: string;
      };
      expect(row.attempts).toBe(1);
      expect(row.last_error).toBe("network fail");
      expect(
        new Date(row.next_attempt).getTime(),
      ).toBeGreaterThan(Date.now() - 1000);
    });

    test("truncates very long error messages", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      const [m] = await listPending();
      await markFailed(m, "x".repeat(2000));
      const row = _testDb()
        .prepare("SELECT last_error FROM pending_mutations WHERE id = ?")
        .get(m.id) as { last_error: string };
      expect(row.last_error.length).toBeLessThanOrEqual(500);
    });
  });

  describe("resetMutation / deleteMutation", () => {
    test("resetMutation clears attempts and last_error", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      const [m] = await listPending();
      await markFailed(m, "boom");
      await resetMutation(m.id);

      const row = _testDb()
        .prepare("SELECT * FROM pending_mutations WHERE id = ?")
        .get(m.id) as {
        attempts: number;
        last_error: string | null;
      };
      expect(row.attempts).toBe(0);
      expect(row.last_error).toBeNull();
    });

    test("deleteMutation hard-drops the mutation", async () => {
      await enqueueUpsert("tasks", {
        id: "t1",
        user_id: "u1",
        title: "Read",
        engine: "mind",
        kind: "main",
        is_active: true,
      });
      const [m] = await listPending();
      await deleteMutation(m.id);
      expect(await countPending()).toBe(0);
    });
  });
});
