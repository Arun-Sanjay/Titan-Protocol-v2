import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import { updateStreak, awardXP } from "../db/gamification";
import type { Habit } from "../db/schema";

const HABITS_KEY = "habits";
function logsKey(dateKey: string) {
  return `habit_logs:${dateKey}`;
}

type HabitState = {
  habits: Habit[];
  completedIds: Record<string, number[]>; // dateKey → habit IDs

  load: (dateKey: string) => void;
  addHabit: (title: string, icon: string, engine?: string) => void;
  deleteHabit: (id: number) => void;
  toggleHabit: (habitId: number, dateKey: string) => boolean;
  getCompletedSet: (dateKey: string) => Set<number>;
};

export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],
  completedIds: {},

  load: (dateKey) => {
    const habits = getJSON<Habit[]>(HABITS_KEY, []);
    const ids = getJSON<number[]>(logsKey(dateKey), []);
    set({ habits, completedIds: { ...get().completedIds, [dateKey]: ids } });
  },

  addHabit: (title, icon, engine = "all") => {
    const id = nextId();
    const habit: Habit = { id, title, engine, icon, created_at: Date.now() };
    const habits = [...get().habits, habit];
    setJSON(HABITS_KEY, habits);
    set({ habits });
  },

  deleteHabit: (id) => {
    const habits = get().habits.filter((h) => h.id !== id);
    setJSON(HABITS_KEY, habits);

    // Bug 11: Clean up orphaned completion IDs for the deleted habit
    const updatedCompletedIds = { ...get().completedIds };
    for (const dateKey of Object.keys(updatedCompletedIds)) {
      const ids = updatedCompletedIds[dateKey];
      if (ids && ids.includes(id)) {
        const filtered = ids.filter((hid) => hid !== id);
        updatedCompletedIds[dateKey] = filtered;
        setJSON(logsKey(dateKey), filtered);
      }
    }

    set({ habits, completedIds: updatedCompletedIds });
  },

  toggleHabit: (habitId, dateKey) => {
    const key = logsKey(dateKey);
    const ids = [...(get().completedIds[dateKey] ?? getJSON<number[]>(key, []))];
    const idx = ids.indexOf(habitId);
    let completed: boolean;

    if (idx !== -1) {
      ids.splice(idx, 1);
      completed = false;
    } else {
      ids.push(habitId);
      completed = true;
    }
    setJSON(key, ids);
    set((s) => ({
      completedIds: { ...s.completedIds, [dateKey]: ids },
    }));

    // Bug 12: Wire up XP/streak on habit completion
    if (completed) {
      updateStreak(dateKey);
      awardXP(dateKey, "habit_complete", 10);
    }

    return completed;
  },

  getCompletedSet: (dateKey) => {
    return new Set(get().completedIds[dateKey] ?? []);
  },
}));
