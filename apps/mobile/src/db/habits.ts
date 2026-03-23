import { db } from "./database";
import type { Habit, HabitLog } from "./schema";

export function listHabits(): Habit[] {
  return db.getAllSync<Habit>("SELECT * FROM habits ORDER BY created_at ASC");
}

export function addHabit(title: string, icon: string, engine = "all"): number {
  const result = db.runSync(
    "INSERT INTO habits (title, engine, icon, created_at) VALUES (?, ?, ?, ?)",
    [title, engine, icon, Date.now()]
  );
  return result.lastInsertRowId;
}

export function deleteHabit(id: number): void {
  db.runSync("DELETE FROM habits WHERE id = ?", [id]);
  db.runSync("DELETE FROM habit_logs WHERE habit_id = ?", [id]);
}

export function toggleHabit(habitId: number, dateKey: string): boolean {
  const existing = db.getFirstSync<HabitLog>(
    "SELECT * FROM habit_logs WHERE habit_id = ? AND date_key = ?",
    [habitId, dateKey]
  );

  if (existing && existing.completed) {
    db.runSync(
      "UPDATE habit_logs SET completed = 0 WHERE habit_id = ? AND date_key = ?",
      [habitId, dateKey]
    );
    return false;
  } else if (existing) {
    db.runSync(
      "UPDATE habit_logs SET completed = 1 WHERE habit_id = ? AND date_key = ?",
      [habitId, dateKey]
    );
    return true;
  } else {
    db.runSync(
      "INSERT INTO habit_logs (habit_id, date_key, completed) VALUES (?, ?, 1)",
      [habitId, dateKey]
    );
    return true;
  }
}

export function getHabitLogsForDate(dateKey: string): Set<number> {
  const rows = db.getAllSync<{ habit_id: number }>(
    "SELECT habit_id FROM habit_logs WHERE date_key = ? AND completed = 1",
    [dateKey]
  );
  return new Set(rows.map((r) => r.habit_id));
}

export function getHabitStreak(habitId: number, fromDate: string): number {
  let streak = 0;
  let dateKey = fromDate;

  while (true) {
    const log = db.getFirstSync<HabitLog>(
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
