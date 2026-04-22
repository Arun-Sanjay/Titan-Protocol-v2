/**
 * Tests for the achievement check pipeline.
 *
 * These exist to lock in the fix for "First Blood pops up every time I
 * open the app". The bug had two root causes, and these tests are
 * written so that either regression would fail them:
 *
 *   A. Condition semantics — `tasks_completed_total` was reading the
 *      protocol streak (wrong concept), which made First Blood fire
 *      whenever streak ≥ 1 regardless of actual task completions.
 *
 *   B. Ordering — the toast was pushed to the Zustand queue BEFORE the
 *      SQLite row was written. If the write silently failed, the toast
 *      still fired and the next session's alreadyUnlocked set was
 *      empty, so the same unlock fired again. Forever.
 *
 * A single-flight guard is tested too, for the race where two taps
 * fire `runAchievementCheck` in parallel: both would see an empty
 * alreadyUnlocked set, both would push the toast, both would try to
 * write. The fix funnels overlapping calls through one in-flight
 * promise.
 */

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u1",
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("../../lib/query-client", () => ({
  queryClient: {
    getQueryData: jest.fn().mockReturnValue(undefined),
    invalidateQueries: jest.fn(),
  },
}));
jest.mock("../../db/storage", () => ({
  getJSON: jest.fn((_key: string, fallback: unknown) => fallback),
  setJSON: jest.fn(),
  storage: {
    getAllKeys: jest.fn(() => []),
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    contains: jest.fn(),
  },
  nextId: jest.fn(() => 1),
}));

jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    const g = globalThis as { __idCounter?: number };
    g.__idCounter = (g.__idCounter ?? 0) + 1;
    return `ach-id-${g.__idCounter}`;
  },
}));

import { _resetTestDb, _testDb } from "../setup/sqlite-fake";
import {
  runAchievementCheck,
  _resetAchievementCheckForTests,
} from "../../lib/achievement-integration";
import {
  checkAllAchievements,
  type AppState,
} from "../../lib/achievement-checker";
import { useAchievementStore } from "../../stores/useAchievementStore";
import {
  insertUnlockedAchievements,
  listUnlockedAchievements,
} from "../../services/achievements";
import { createTask, toggleCompletion } from "../../services/tasks";
import { upsertProfile } from "../../services/profile";

const TODAY = "2026-04-23";

function resetStore(): void {
  useAchievementStore.setState({
    pendingCelebration: null,
    celebrationQueue: [],
  });
}

function baseAppState(overrides: Partial<AppState> = {}): AppState {
  return {
    titanScore: 0,
    engineScores: { body: 0, mind: 0, money: 0, charisma: 0 },
    protocolStreak: 0,
    protocolCompleteToday: false,
    protocolCompletionHour: undefined,
    dayNumber: 1,
    totalCompletionsCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  _resetTestDb();
  _resetAchievementCheckForTests();
  resetStore();
  (globalThis as { __idCounter?: number }).__idCounter = 0;
});

// ─── Pure checker layer ─────────────────────────────────────────────────────

describe("checkAllAchievements — pure function contract", () => {
  test("does NOT push to the Zustand queue (caller's responsibility)", () => {
    const pending = checkAllAchievements(
      baseAppState({ totalCompletionsCount: 1 }),
      new Set(),
    );
    expect(pending.length).toBeGreaterThan(0);
    // The celebration queue must be untouched — that's the whole point of
    // the refactor. The caller decides whether to push (only after the
    // insert succeeds).
    expect(useAchievementStore.getState().pendingCelebration).toBeNull();
    expect(useAchievementStore.getState().celebrationQueue).toEqual([]);
  });

  test("tasks_completed_total reads totalCompletionsCount (NOT protocolStreak)", () => {
    // The pre-fix checker read from `protocolStreak`, which is a
    // different concept: protocol = daily ritual, not task completions.
    // Guard: streak >= 1 but no completions → First Blood must NOT fire.
    const pending = checkAllAchievements(
      baseAppState({ protocolStreak: 7, totalCompletionsCount: 0 }),
      new Set(),
    );
    const ids = pending.map((p) => p.id);
    expect(ids).not.toContain("ach_first_blood");
  });

  test("tasks_completed_total fires at exactly the target count", () => {
    const zero = checkAllAchievements(
      baseAppState({ totalCompletionsCount: 0 }),
      new Set(),
    );
    expect(zero.map((p) => p.id)).not.toContain("ach_first_blood");

    const one = checkAllAchievements(
      baseAppState({ totalCompletionsCount: 1 }),
      new Set(),
    );
    expect(one.map((p) => p.id)).toContain("ach_first_blood");
  });

  test("skips achievements already in alreadyUnlocked", () => {
    const pending = checkAllAchievements(
      baseAppState({ totalCompletionsCount: 1 }),
      new Set(["ach_first_blood"]),
    );
    expect(pending.map((p) => p.id)).not.toContain("ach_first_blood");
  });

  test("idempotent: running twice with the same state and no new unlocks returns []", () => {
    const state = baseAppState({ totalCompletionsCount: 1 });
    const first = checkAllAchievements(state, new Set());
    const known = new Set([...first.map((p) => p.id)]);
    const second = checkAllAchievements(state, known);
    expect(second).toEqual([]);
  });
});

// ─── Integration layer ──────────────────────────────────────────────────────

async function seedOneCompletion(): Promise<void> {
  // Seed the user + one task + one completion so `gatherAppState` can
  // compute a truthful `totalCompletionsCount`. `upsertProfile` also
  // stamps first_use_date so day-number calcs don't behave oddly.
  await upsertProfile({});
  const t = await createTask({ title: "first tap", engine: "body" });
  await toggleCompletion({ taskId: t.id, dateKey: TODAY, engine: "body" });
}

describe("runAchievementCheck — end-to-end idempotency", () => {
  test("first run: inserts unlock row + pushes toast", async () => {
    await seedOneCompletion();

    await runAchievementCheck();

    const rows = await listUnlockedAchievements();
    const ids = rows.map((r) => r.achievement_id);
    expect(ids).toContain("ach_first_blood");

    // Toast queue should now have First Blood (either as pending or in queue)
    const state = useAchievementStore.getState();
    const allQueued = [
      state.pendingCelebration?.id,
      ...state.celebrationQueue.map((c) => c.id),
    ].filter(Boolean);
    expect(allQueued).toContain("ach_first_blood");
  });

  test("second run (simulating app-relaunch): no duplicate toast, no duplicate row", async () => {
    await seedOneCompletion();
    await runAchievementCheck();
    resetStore(); // Zustand is memory-only — mimic a cold-start.

    await runAchievementCheck();

    // Row still exists (didn't get wiped) and wasn't re-inserted.
    const rows = await listUnlockedAchievements();
    const firstBloodRows = rows.filter(
      (r) => r.achievement_id === "ach_first_blood",
    );
    expect(firstBloodRows).toHaveLength(1);

    // Toast queue is empty because the check saw First Blood already unlocked.
    const state = useAchievementStore.getState();
    expect(state.pendingCelebration).toBeNull();
    expect(state.celebrationQueue).toEqual([]);
  });

  test("toast is pushed AFTER the DB write lands (not before)", async () => {
    await seedOneCompletion();

    // Intercept insertUnlockedAchievements so we can assert the store is
    // untouched at the time the insert is about to happen.
    const originalInsert = insertUnlockedAchievements;
    type InsertSnapshot = { pending: unknown; queue: unknown[] };
    let storeStateAtInsertStart: InsertSnapshot | null = null;
    const spy = jest
      .spyOn(
        require("../../services/achievements") as {
          insertUnlockedAchievements: typeof insertUnlockedAchievements;
        },
        "insertUnlockedAchievements",
      )
      .mockImplementation(async (ids: string[]) => {
        const s = useAchievementStore.getState();
        storeStateAtInsertStart = {
          pending: s.pendingCelebration,
          queue: s.celebrationQueue,
        };
        return originalInsert(ids);
      });

    try {
      await runAchievementCheck();
    } finally {
      spy.mockRestore();
    }

    // The store was empty at the moment the insert was dispatched.
    expect(storeStateAtInsertStart).not.toBeNull();
    const captured = storeStateAtInsertStart as InsertSnapshot | null;
    expect(captured?.pending).toBeNull();
    expect(captured?.queue).toEqual([]);

    // AFTER the insert returns, the toast lands.
    const postInsert = useAchievementStore.getState();
    const allQueued = [
      postInsert.pendingCelebration?.id,
      ...postInsert.celebrationQueue.map((c) => c.id),
    ].filter(Boolean);
    expect(allQueued).toContain("ach_first_blood");
  });

  test("if the DB write fails, NO toast is pushed — prevents ghost celebrations", async () => {
    await seedOneCompletion();

    const spy = jest
      .spyOn(
        require("../../services/achievements") as {
          insertUnlockedAchievements: typeof insertUnlockedAchievements;
        },
        "insertUnlockedAchievements",
      )
      .mockRejectedValue(new Error("synthetic insert failure"));

    try {
      await runAchievementCheck();
    } finally {
      spy.mockRestore();
    }

    const state = useAchievementStore.getState();
    expect(state.pendingCelebration).toBeNull();
    expect(state.celebrationQueue).toEqual([]);

    // And no row was persisted — so on the NEXT run with a working DB,
    // the check re-attempts the unlock. That's correct behavior: the
    // user gets their achievement eventually, and only once.
    const rows = await listUnlockedAchievements();
    expect(
      rows.find((r) => r.achievement_id === "ach_first_blood"),
    ).toBeUndefined();
  });
});

describe("runAchievementCheck — single-flight guard", () => {
  test("two concurrent calls share one run (no duplicate inserts, no duplicate toasts)", async () => {
    await seedOneCompletion();

    // Fire two checks before either resolves — the race a rapid double-tap
    // would produce.
    await Promise.all([runAchievementCheck(), runAchievementCheck()]);

    // Exactly one row for First Blood.
    const rows = await listUnlockedAchievements();
    const firstBloodRows = rows.filter(
      (r) => r.achievement_id === "ach_first_blood",
    );
    expect(firstBloodRows).toHaveLength(1);

    // Exactly one toast (either pending or in queue, not two).
    const state = useAchievementStore.getState();
    const allQueued = [
      state.pendingCelebration?.id,
      ...state.celebrationQueue.map((c) => c.id),
    ].filter((id) => id === "ach_first_blood");
    expect(allQueued).toHaveLength(1);
  });

  test("after a run completes, a new run is free to start (guard resets)", async () => {
    await seedOneCompletion();
    await runAchievementCheck();

    // First-Blood already unlocked; adding more completions shouldn't
    // re-fire it, but a second run should be allowed to execute (and
    // should find nothing new). The promise should resolve, not hang.
    await expect(runAchievementCheck()).resolves.toBeUndefined();
  });
});

describe("regression: the exact scenario the user reported", () => {
  test("First Blood: complete → relaunch → no re-popup", async () => {
    // Day 1: user opens app, taps one task. First Blood unlocks.
    await seedOneCompletion();
    await runAchievementCheck();
    expect(
      (await listUnlockedAchievements()).map((r) => r.achievement_id),
    ).toContain("ach_first_blood");

    // Simulate app relaunch — Zustand memory cleared, but SQLite persists.
    resetStore();
    _resetAchievementCheckForTests();

    // Day 2: user opens app, taps another task. Check runs again.
    const t2 = await createTask({ title: "second tap", engine: "mind" });
    await toggleCompletion({
      taskId: t2.id,
      dateKey: "2026-04-24",
      engine: "mind",
    });
    await runAchievementCheck();

    // First Blood must not appear in the toast queue a second time.
    const state = useAchievementStore.getState();
    const queuedFirstBlood = [
      state.pendingCelebration?.id,
      ...state.celebrationQueue.map((c) => c.id),
    ].filter((id) => id === "ach_first_blood");
    expect(queuedFirstBlood).toHaveLength(0);
  });
});
