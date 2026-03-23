import { getDB } from "./database";
import type { Habit, HabitLog } from "./schema";

export async function listHabits(): Promise<Habit[]> {
  const db = await getDB();
  return db.getAllAsync<Habit>("SELECT * FROM habits ORDER BY created_at ASC");
}

export async function addHabit(title: string, icon: string, engine = "all"): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    "INSERT INTO habits (title, engine, icon, created_at) VALUES (?, ?, ?, ?)",
    [title, engine, icon, Date.now()]
  );
  return result.lastInsertRowId;
}

export async function deleteHabit(id: number): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM habits WHERE id = ?", [id]);
  await db.runAsync("DELETE FROM habit_logs WHERE habit_id = ?", [id]);
}

export async function toggleHabit(habitId: number, dateKey: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.getFirstAsync<HabitLog>(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey]
  );

  if (existing && existing.completed) {
    await db.runAsync(
      "UPDATE habit_logs SET completed = 0 WHERE habit_id = ? AND date_key = ?",
      [habitId, dateKey]
    );
    return false;
  } else if (existing) {
    await db.runAsync(
      "UPDATE habit_logs SET completed = 1 WHERE habit_id = ? AND date_key = ?",
      [habitId, dateKey]
    );
    return true;
  } else {
    await db.runAsync(
      "INSERT INTO habit_logs (habit_id, date_key, completed) VALUES (?, ?, 1)",
      [habitId, dateKey]
    );
    return true;
  }
}

export async function getHabitLogsForDate(dateKey: string): Promise<Set<number>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ habit_id: number }>(
    "SELECT habit_id FROM habit_logs WHERE date_key = ? AND completed = 1",
    [dateKey]
  );
  return new Set(rows.map((r) => r.habit_id));
}

export async function getHabitStreak(habitId: number, fromDate: string): Promise<number> {
  const db = await getDB();
  let streak = 0;
  let dateKey = fromDate;

  while (true) {
    const log = await db.getFirstAsync<HabitLog>(
      "SELECT * FROM habit_logs WHERE habit_id = ? AND date_key = ? AND completed = 1",
      [habitId, dateKey]
    );
    if (!log) break;
    streak++;
    const d = new Date(dateKey + "T00:00:00");
    d.setDate(d.getDate() - 1);
    dateKey = d.toISOString().slice(0, 10);
  }

  return streak;
}
