jest.mock("../../db/sqlite/service-helpers", () => {
  const actual = jest.requireActual("../../db/sqlite/service-helpers");
  return {
    ...actual,
    cloudUpsert: actual.sqliteUpsert,
    cloudUpsertMany: actual.sqliteUpsertMany,
    cloudDelete: actual.sqliteDelete,
  };
});

jest.mock("../../db/sqlite/client", () => require("../setup/sqlite-fake"));
jest.mock("../../lib/supabase", () => ({
  supabase: {},
  requireUserId: async () => "u1",
  ensureProfileRow: async () => {},
}));
jest.mock("../../lib/error-log", () => ({ logError: jest.fn() }));
jest.mock("expo-crypto", () => ({
  randomUUID: () => {
    const g = globalThis as { __idCounter?: number };
    g.__idCounter = (g.__idCounter ?? 0) + 1;
    return `test-id-${g.__idCounter}`;
  },
}));

import { _resetTestDb } from "../setup/sqlite-fake";
import {
  createHabit,
  listHabits,
  toggleHabitLog,
  listHabitLogsForDate,
} from "../../services/habits";
import { getTodayKey, addDays } from "../../lib/date";

describe("habits service", () => {
  beforeEach(() => {
    _resetTestDb();
    (globalThis as { __idCounter?: number }).__idCounter = 0;
  });

  test("createHabit returns a JS-typed row with chain counters at 0", async () => {
    const h = await createHabit({
      title: "Morning pages",
      engine: "mind",
    });
    expect(h.current_chain).toBe(0);
    expect(h.best_chain).toBe(0);
    expect(h.last_broken_date).toBeNull();
    expect((await listHabits())[0].id).toBe(h.id);
  });

  test("toggleHabitLog toggles presence", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    const r1 = await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-18" });
    expect(r1.added).toBe(true);
    expect(await listHabitLogsForDate("2026-04-18")).toHaveLength(1);

    const r2 = await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-18" });
    expect(r2.added).toBe(false);
    expect(await listHabitLogsForDate("2026-04-18")).toHaveLength(0);
  });

  test("logging today + the two days before sets current_chain=3 and best_chain=3", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    const today = getTodayKey();
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -2) });
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -1) });
    await toggleHabitLog({ habitId: h.id, dateKey: today });

    const habits = await listHabits();
    expect(habits[0].current_chain).toBe(3);
    expect(habits[0].best_chain).toBe(3);
  });

  test("breaking the chain keeps best_chain but resets current_chain", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    const today = getTodayKey();
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -2) });
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -1) });
    await toggleHabitLog({ habitId: h.id, dateKey: today });
    // un-log every recent day → the today-anchored chain collapses to 0,
    // but best_chain (3) is preserved.
    await toggleHabitLog({ habitId: h.id, dateKey: today });
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -1) });
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -2) });

    const habits = await listHabits();
    expect(habits[0].current_chain).toBe(0);
    expect(habits[0].best_chain).toBe(3);
  });

  test("current_chain is anchored to today — back-filling an old day doesn't clobber it (§3.7)", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    const today = getTodayKey();
    // A live 2-day chain ending today.
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -1) });
    await toggleHabitLog({ habitId: h.id, dateKey: today });
    expect((await listHabits())[0].current_chain).toBe(2);

    // Back-fill a single ancient day — must NOT clobber the live chain.
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -40) });
    const habits = await listHabits();
    expect(habits[0].current_chain).toBe(2);
    expect(habits[0].best_chain).toBe(2);
  });

  test("a non-consecutive day doesn't extend the chain", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    const today = getTodayKey();
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -3) });
    // skipping today-2
    await toggleHabitLog({ habitId: h.id, dateKey: addDays(today, -1) });
    await toggleHabitLog({ habitId: h.id, dateKey: today });

    const habits = await listHabits();
    // chain back from today: today + today-1 logged, today-2 missing → 2.
    expect(habits[0].current_chain).toBe(2);
  });
});