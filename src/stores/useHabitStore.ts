import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import type { Habit, HabitLog } from "../db/schema";

type HabitStats = {
  currentChain: number;
  bestChain: number;
  totalCompletions: number;
};

type HabitState = {
  habits: Habit[];
  logs: HabitLog[];
  /** Cache of completed habit IDs per date-key, warmed by loadDateRange. */
  completedIds: Record<string, number[]>;

  addHabit: (title: string, icon: string, engine: string, trigger?: string) => void;
  getHabitStats: (habitId: number, lookbackDays?: number) => HabitStats;
  setHabits: (habits: Habit[]) => void;
  addLog: (log: HabitLog) => void;
  /** Warm the completedIds cache for a date range. */
  loadDateRange: (startKey: string, endKey: string) => void;
};

export const useHabitStore = create<HabitState>((set, get) => ({
  habits: getJSON<Habit[]>("habits_list", []),
  logs: getJSON<HabitLog[]>("habit_logs_all", []),
  completedIds: {},

  addHabit: (title, icon, engine, trigger) => {
    const id = nextId();
    const habit: Habit = {
      id,
      title,
      engine,
      icon,
      created_at: Date.now(),
      trigger,
    };
    set((s) => {
      const habits = [...s.habits, habit];
      setJSON("habits_list", habits);
      return { habits };
    });
  },

  getHabitStats: (habitId, _lookbackDays?) => {
    const { logs } = get();
    const habitLogs = logs.filter((l) => l.habit_id === habitId && l.completed);
    return {
      currentChain: 0, // Computed by cloud hooks in production
      bestChain: 0,
      totalCompletions: habitLogs.length,
    };
  },

  setHabits: (habits) => {
    setJSON("habits_list", habits);
    set({ habits });
  },

  addLog: (log) => {
    set((s) => {
      const logs = [...s.logs, log];
      setJSON("habit_logs_all", logs);
      return { logs };
    });
  },

  loadDateRange: (startKey, endKey) => {
    const { logs } = get();
    const cache: Record<string, number[]> = {};
    // Build date range
    const start = new Date(startKey);
    const end = new Date(endKey);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      cache[dk] = logs
        .filter((l) => l.date_key === dk && l.completed)
        .map((l) => l.habit_id);
    }
    set({ completedIds: cache });
  },
}));
