import { requireUserId } from "../lib/session";
import {
  newId,
  cloudDelete,
  sqliteGet,
  sqliteList,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import { addDaysISO, todayISO } from "../lib/date";
import type { Tables } from "@titan/shared/types/supabase";

export type Habit = Tables<"habits">;
export type HabitLog = Tables<"habit_logs">;

// ─── Habits ─────────────────────────────────────────────────────────────────

export async function listHabits(): Promise<Habit[]> {
  return sqliteList<Habit>("habits", { order: "created_at ASC" });
}

export async function createHabit(habit: {
  title: string;
  engine: string;
  icon?: string;
  trigger_text?: string;
  duration_text?: string;
  frequency?: string;
}): Promise<Habit> {
  const userId = await requireUserId();
  const row: Habit = {
    id: newId(),
    user_id: userId,
    title: habit.title,
    engine: habit.engine,
    icon: habit.icon ?? "🔄",
    trigger_text: habit.trigger_text ?? null,
    duration_text: habit.duration_text ?? null,
    frequency: habit.frequency ?? "daily",
    current_chain: 0,
    best_chain: 0,
    last_broken_date: null,
    legacy_local_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return cloudUpsert("habits", row);
}

export async function deleteHabit(habitId: string): Promise<void> {
  await cloudDelete("habits", { id: habitId });
}

// ─── Habit logs ─────────────────────────────────────────────────────────────

export async function listHabitLogsForDate(
  dateKey: string,
): Promise<HabitLog[]> {
  return sqliteList<HabitLog>("habit_logs", {
    where: "date_key = ?",
    params: [dateKey],
  });
}

export async function listHabitLogsForRange(
  startDate: string,
  endDate: string,
): Promise<HabitLog[]> {
  return sqliteList<HabitLog>("habit_logs", {
    where: "date_key >= ? AND date_key <= ?",
    params: [startDate, endDate],
    order: "date_key ASC",
  });
}

/**
 * Toggle a habit log for a given date. If present → un-complete; else → complete.
 * Recomputes the habit's current_chain + best_chain afterwards.
 */
export async function toggleHabitLog(params: {
  habitId: string;
  dateKey: string;
}): Promise<{ added: boolean }> {
  const userId = await requireUserId();

  const [existing] = await sqliteList<HabitLog>("habit_logs", {
    where: "habit_id = ? AND date_key = ?",
    params: [params.habitId, params.dateKey],
    limit: 1,
  });

  let added: boolean;
  if (existing) {
    await cloudDelete("habit_logs", { id: existing.id });
    added = false;
  } else {
    await cloudUpsert("habit_logs", {
      id: newId(),
      user_id: userId,
      habit_id: params.habitId,
      date_key: params.dateKey,
      created_at: new Date().toISOString(),
    });
    added = true;
  }

  await recalculateChain(params.habitId, params.dateKey);
  return { added };
}

// ─── Chain ──────────────────────────────────────────────────────────────────

/**
 * Recalculate `current_chain` + `best_chain` for a habit. `current_chain` is
 * always anchored to TODAY, never the toggled `dateKey`: it counts consecutive
 * logged days ending today — or yesterday if today isn't logged yet, so the
 * chain stays alive until a full day is actually missed. This is why
 * back-filling an old day no longer clobbers a live chain (audit §3.7) —
 * `dateKey` only widens the scan window so an older back-fill can still raise
 * `best_chain` (the longest consecutive run anywhere in the window).
 */
async function recalculateChain(
  habitId: string,
  dateKey: string,
): Promise<void> {
  const today = todayISO();
  const windowStart = subtractDays(today, 90);
  const scanStart = dateKey < windowStart ? dateKey : windowStart;

  const logs = await sqliteList<{ date_key: string }>("habit_logs", {
    where: "habit_id = ? AND date_key >= ? AND date_key <= ?",
    params: [habitId, scanStart, today],
    order: "date_key ASC",
  });
  const logDates = new Set(logs.map((l) => l.date_key));

  let chain = 0;
  let cursor = logDates.has(today) ? today : subtractDays(today, 1);
  while (logDates.has(cursor)) {
    chain++;
    cursor = subtractDays(cursor, 1);
  }

  const habit = await sqliteGet<Habit>("habits", { id: habitId });
  if (!habit) return; // habit was deleted mid-toggle; nothing to do

  // best_chain: longest consecutive run anywhere in the scanned window.
  let best = habit.best_chain ?? 0;
  let run = 0;
  for (let d = scanStart; d <= today; d = addDaysISO(d, 1)) {
    if (logDates.has(d)) {
      run++;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  const justBroke = chain === 0 && (habit.current_chain ?? 0) > 0;
  await cloudUpsert("habits", {
    ...habit,
    current_chain: chain,
    best_chain: best,
    last_broken_date: justBroke ? today : habit.last_broken_date,
  });
}

/** Subtract N days from a YYYY-MM-DD string. */
function subtractDays(dateKey: string, days: number): string {
  return addDaysISO(dateKey, -days);
}
