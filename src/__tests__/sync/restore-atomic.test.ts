/**
 * Regression tests for the pull-then-swap fix in src/sync/restore.ts.
 *
 * Before the fix, restore wiped local SQLite BEFORE the first remote
 * fetch ran. A network/RLS error mid-pull left the device with partial
 * (and visibly empty) data while the UI reported "RESTORE FAILED".
 *
 * The fix stages every table in memory; if any pull fails, local data
 * is untouched. Only after every pull succeeds do we wipe + reinsert
 * inside one SQLite transaction.
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
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
import { restoreFromCloud } from "../../sync/restore";
import type { SupabaseFakeState } from "../setup/supabase-fake";

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

describe("restoreFromCloud — atomicity", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    _resetTestDb();
    getFake().state.reset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  test("a fetch failure mid-restore leaves local SQLite untouched", async () => {
    // Seed local data the user would lose if restore wiped before pulling.
    const db = _testDb();
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title) VALUES (?, ?, ?, ?)",
    ).run("local-1", "u1", "body", "I exist locally");

    // `tasks` returns an error mid-pull. Restore aborts before the wipe
    // phase, so local data must survive untouched.
    getFake().state.setSelectError("tasks", { message: "boom" });

    const pending = restoreFromCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(false);

    // Local data must still be there. If this assertion fires, the fix
    // regressed and a network blip would erase the user's data.
    const survived = db
      .prepare("SELECT COUNT(*) AS c FROM tasks WHERE id = ?")
      .get("local-1") as { c: number };
    expect(survived.c).toBe(1);
  });

  test("happy path: cloud rows replace local, marked _dirty=0 _deleted=0", async () => {
    const db = _testDb();
    // Pre-existing local row that should be replaced by the restore.
    db.prepare(
      "INSERT INTO tasks (id, user_id, engine, title) VALUES (?, ?, ?, ?)",
    ).run("local-1", "u1", "mind", "stale");

    getFake().state.setSelectData("tasks", [
      {
        id: "cloud-1",
        user_id: "u1",
        engine: "body",
        title: "from cloud",
        kind: "main",
        days_per_week: 7,
        is_active: true,
        legacy_local_id: null,
        created_at: "2026-04-23T00:00:00.000Z",
        updated_at: "2026-04-23T00:00:00.000Z",
      },
    ]);

    const pending = restoreFromCloud();
    await jest.runAllTimersAsync();
    const result = await pending;

    expect(result.success).toBe(true);

    const rows = db
      .prepare("SELECT id, _dirty, _deleted FROM tasks ORDER BY id")
      .all() as { id: string; _dirty: number; _deleted: number }[];
    expect(rows).toEqual([
      { id: "cloud-1", _dirty: 0, _deleted: 0 },
    ]);
  });
});
