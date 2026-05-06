jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("../../lib/supabase", () => ({
  requireUserId: async () =>
    (globalThis as { __testUserId?: string }).__testUserId ?? "u1",
  supabase: {
    auth: {
      refreshSession: async () => ({}),
    },
    from: (table: string) => ({
      upsert: async (batch: unknown[], options: unknown) => {
        const g = globalThis as {
          __backupUploads?: Array<{
            table: string;
            batch: unknown[];
            options: unknown;
          }>;
        };
        g.__backupUploads = g.__backupUploads ?? [];
        g.__backupUploads.push({ table, batch, options });
        return { error: null };
      },
    }),
  },
}));

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import { backupToCloud } from "../../sync/backup";

describe("backupToCloud", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    _resetTestDb();
    (globalThis as { __testUserId?: string }).__testUserId = "u1";
    (globalThis as { __backupUploads?: unknown[] }).__backupUploads = [];
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("uploads only rows owned by the current user", async () => {
    const db = _testDb();
    db.prepare("INSERT INTO profiles (id, email) VALUES (?, ?)").run(
      "u1",
      "u1@example.test",
    );
    db.prepare("INSERT INTO profiles (id, email) VALUES (?, ?)").run(
      "u2",
      "u2@example.test",
    );
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title) VALUES (?, ?, ?, ?)",
    ).run("task-u1", "u1", "mind", "u1 task");
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title) VALUES (?, ?, ?, ?)",
    ).run("task-u2", "u2", "body", "u2 task");

    const pending = backupToCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(true);
    const uploads = (globalThis as {
      __backupUploads?: Array<{ table: string; batch: Array<{ id?: string }> }>;
    }).__backupUploads ?? [];
    const rowsByTable = new Map(uploads.map((u) => [u.table, u.batch]));

    expect(rowsByTable.get("profiles")?.map((r) => r.id)).toEqual(["u1"]);
    expect(rowsByTable.get("tasks")?.map((r) => r.id)).toEqual(["task-u1"]);
  });
});
