import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import type { Habit } from "../db/schema";

const HABITS_KEY = "habits";
function logsKey(dateKey: string) {
  return `habit_logs:${dateKey}`;
}

export type HabitStats = {
  currentChain: number;
  longestChain: number;
  completionRate: number; // 0-100
  totalDays: number;
  completedDays: number;
};

type HabitState = {
  habits: Habit[];
  completedIds: Record<string, number[]>; // dateKey → habit IDs

  load: (dateKey: string) => void;
  addHabit: (title: string, icon: string, engine?: string, trigger?: string, duration?: string, frequency?: string) => void;
  deleteHabit: (id: number) => void;
  toggleHabit: (habitId: number, dateKey: string) => boolean;
  getCompletedSet: (dateKey: string) => Set<number>;
  /** Get stats for a single habit over the last N days */
  getHabitStats: (habitId: number, days?: number) => HabitStats;
  /** Get overall habit completion score for today */
  getOverallHabitScore: (dateKey: string) => number;
};

export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],
  completedIds: {},

  load: (dateKey) => {
    const habits = getJSON<Habit[]>(HABITS_KEY, []);
    const ids = getJSON<number[]>(logsKey(dateKey), []);
    set({ habits, completedIds: { ...get().completedIds, [dateKey]: ids } });
  },

  addHabit: (title, icon, engine = "all", trigger, duration, frequency) => {
    const id = nextId();
    const habit: Habit = { id, title, engine, icon, created_at: Date.now(), trigger, duration, frequency };
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

    // XP/streak is handled by the UI component (track.tsx HabitsTab)
    // to avoid dual-write race on the MMKV user_profile key
    return completed;
  },

  getCompletedSet: (dateKey) => {
    return new Set(get().completedIds[dateKey] ?? []);
  },

  getHabitStats: (habitId, days = 90) => {
    let currentChain = 0;
    let longestChain = 0;
    let completedDays = 0;
    let chainBroken = false;

    // Walk backward from today — current chain = consecutive days from today
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const logs = getJSON<number[]>(logsKey(dk), []);

      if (logs.includes(habitId)) {
        completedDays++;
        if (!chainBroken) currentChain++;
      } else {
        chainBroken = true;
      }
    }

    // Longest chain: scan all days for the longest consecutive run
    let runningChain = 0;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const logs = getJSON<number[]>(logsKey(dk), []);

      if (logs.includes(habitId)) {
        runningChain++;
        longestChain = Math.max(longestChain, runningChain);
      } else {
        runningChain = 0;
      }
    }

    return {
      currentChain,
      longestChain,
      completionRate: days > 0 ? Math.round((completedDays / days) * 100) : 0,
      totalDays: days,
      completedDays,
    };
  },

  getOverallHabitScore: (dateKey) => {
    const { habits, completedIds } = get();
    if (habits.length === 0) return 0;
    const ids = completedIds[dateKey] ?? [];
    return Math.round((ids.length / habits.length) * 100);
  },
}));
