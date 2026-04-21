import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

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
  return sqliteUpsert("habits", row);
}

export async function deleteHabit(habitId: string): Promise<void> {
  await sqliteDelete("habits", { id: habitId });
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
    await sqliteDelete("habit_logs", { id: existing.id });
    added = false;
  } else {
    await sqliteUpsert("habit_logs", {
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
 * Recalculate `current_chain` + `best_chain` for a habit, walking backwards
 * from `dateKey` through consecutive logged days. A day without a log breaks
 * the chain; `last_broken_date` is stamped when the chain collapses.
 *
 * 90-day window is more than enough for the longest streak we care about.
 */
async function recalculateChain(
  habitId: string,
  dateKey: string,
): Promise<void> {
  const startDate = subtractDays(dateKey, 90);
  const logs = await sqliteList<{ date_key: string }>("habit_logs", {
    where: "habit_id = ? AND date_key >= ? AND date_key <= ?",
    params: [habitId, startDate, dateKey],
    order: "date_key DESC",
  });
  const logDates = new Set(logs.map((l) => l.date_key));

  let chain = 0;
  let cursor = dateKey;
  while (logDates.has(cursor)) {
    chain++;
    cursor = subtractDays(cursor, 1);
  }

  const habit = await sqliteGet<Habit>("habits", { id: habitId });
  if (!habit) return; // habit was deleted mid-toggle; nothing to do

  const oldBest = habit.best_chain ?? 0;
  const newBest = Math.max(oldBest, chain);
  const justBroke = chain === 0 && (habit.current_chain ?? 0) > 0;

  await sqliteUpsert("habits", {
    ...habit,
    current_chain: chain,
    best_chain: newBest,
    last_broken_date: justBroke ? dateKey : habit.last_broken_date,
  });
}

/** Subtract N days from a YYYY-MM-DD string. */
function subtractDays(dateKey: string, days: number): string {
  const d = new Date(dateKey + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
