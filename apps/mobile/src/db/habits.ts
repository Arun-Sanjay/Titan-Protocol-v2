import { getJSON, setJSON, nextId } from "./storage";
import type { Habit } from "./schema";

const HABITS_KEY = "habits";

function logsKey(dateKey: string): string {
  return `habit_logs:${dateKey}`;
}

export function listHabits(): Habit[] {
  return getJSON<Habit[]>(HABITS_KEY, []);
}

export function addHabit(title: string, icon: string, engine = "all"): number {
  const id = nextId();
  const habit: Habit = { id, title, engine, icon, created_at: Date.now() };
  const habits = listHabits();
  habits.push(habit);
  setJSON(HABITS_KEY, habits);
  return id;
}

export function deleteHabit(id: number): void {
  const habits = listHabits().filter((h) => h.id !== id);
  setJSON(HABITS_KEY, habits);
}

export function toggleHabit(habitId: number, dateKey: string): boolean {
  const key = logsKey(dateKey);
  const completed = getJSON<number[]>(key, []);
  const idx = completed.indexOf(habitId);

  if (idx !== -1) {
    completed.splice(idx, 1);
    setJSON(key, completed);
    return false;
  } else {
    completed.push(habitId);
    setJSON(key, completed);
    return true;
  }
}

export function getHabitLogsForDate(dateKey: string): Set<number> {
  return new Set(getJSON<number[]>(logsKey(dateKey), []));
}
