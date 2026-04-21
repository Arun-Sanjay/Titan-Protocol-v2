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

  test("logging 3 consecutive days sets current_chain=3 and best_chain=3", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-16" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-17" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-18" });

    const habits = await listHabits();
    expect(habits[0].current_chain).toBe(3);
    expect(habits[0].best_chain).toBe(3);
  });

  test("breaking the chain keeps best_chain but resets current_chain", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-16" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-17" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-18" });
    // un-log the most recent — chain resets from today
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-18" });

    const habits = await listHabits();
    expect(habits[0].current_chain).toBe(0);
    expect(habits[0].best_chain).toBe(3);
    expect(habits[0].last_broken_date).toBe("2026-04-18");
  });

  test("a non-consecutive day doesn't extend the chain", async () => {
    const h = await createHabit({ title: "x", engine: "mind" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-15" });
    // skipping 2026-04-16
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-17" });
    await toggleHabitLog({ habitId: h.id, dateKey: "2026-04-18" });

    const habits = await listHabits();
    // chain counted backwards from 2026-04-18: 17 logged, 16 missing → breaks.
    expect(habits[0].current_chain).toBe(2);
  });
});
