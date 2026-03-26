import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
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
    set({ habits });
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
    return completed;
  },

  getCompletedSet: (dateKey) => {
    return new Set(get().completedIds[dateKey] ?? []);
  },
}));
