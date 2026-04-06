import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";
import { K } from "../db/keys";
import type { Habit } from "../db/schema";

const HABITS_KEY = K.habits;
const logsKey = (dateKey: string) => K.habitLogs(dateKey);

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
  /**
   * Phase 2.3F: Pre-load habit logs for a date range so getHabitStats
   * doesn't have to hit MMKV per-habit per-day. Call this once when a
   * screen that needs stats mounts (e.g. habits, analytics).
   */
  loadDateRange: (startDateKey: string, endDateKey: string) => void;
  addHabit: (title: string, icon: string, engine?: string, trigger?: string, duration?: string, frequency?: string) => void;
  deleteHabit: (id: number) => void;
  toggleHabit: (habitId: number, dateKey: string) => boolean;
  getCompletedSet: (dateKey: string) => Set<number>;
  /** Get stats for a single habit over the last N days */
  getHabitStats: (habitId: number, days?: number) => HabitStats;
  /** Get overall habit completion score for today */
  getOverallHabitScore: (dateKey: string) => number;
};

// Phase 2.3F: helper to format a Date as YYYY-MM-DD without re-allocating
// every iteration in stat loops.
function formatDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const useHabitStore = create<HabitState>()((set, get) => ({
  habits: [],
  completedIds: {},

  load: (dateKey) => {
    const habits = getJSON<Habit[]>(HABITS_KEY, []);
    const ids = getJSON<number[]>(logsKey(dateKey), []);
    set({ habits, completedIds: { ...get().completedIds, [dateKey]: ids } });
  },

  loadDateRange: (startDateKey, endDateKey) => {
    // Phase 2.3F: batch-load habit logs for a date range into the store
    // cache. Used by screens that show habit stats so getHabitStats can
    // read from memory instead of doing per-day MMKV reads in a hot loop.
    const start = new Date(`${startDateKey}T00:00:00`);
    const end = new Date(`${endDateKey}T00:00:00`);
    if (start > end) return;

    const updates: Record<string, number[]> = {};
    const cache = get().completedIds;
    const cursor = new Date(start);
    while (cursor <= end) {
      const dk = formatDateKey(cursor);
      if (cache[dk] === undefined) {
        updates[dk] = getJSON<number[]>(logsKey(dk), []);
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (Object.keys(updates).length > 0) {
      set((s) => ({ completedIds: { ...s.completedIds, ...updates } }));
    }
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
    // Phase 2.3F: previously this did 2N MMKV reads per call (180 reads
    // per habit per render). With 20 habits on the analytics screen
    // that's ~3600 disk operations per render — visible jank on Android.
    //
    // New approach: build a single in-memory dateKey → number[] map
    // covering the range, then iterate once to compute both currentChain
    // and longestChain. Missing dates are fetched from MMKV on demand
    // and cached in store state for subsequent calls.
    let currentChain = 0;
    let longestChain = 0;
    let completedDays = 0;
    let chainBroken = false;

    // Build the date list once.
    const dateKeys: string[] = [];
    const today = new Date();
    for (let i = 0; i < days; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      dateKeys.push(formatDateKey(d));
    }

    // Read from store cache; fall back to MMKV for any missing dates and
    // populate the cache so the next call (other habits) is free.
    const cache = get().completedIds;
    const fillIns: Record<string, number[]> = {};
    const dayLogs: number[][] = new Array(dateKeys.length);
    for (let i = 0; i < dateKeys.length; i++) {
      const dk = dateKeys[i];
      let ids = cache[dk];
      if (ids === undefined) {
        ids = getJSON<number[]>(logsKey(dk), []);
        fillIns[dk] = ids;
      }
      dayLogs[i] = ids;
    }
    if (Object.keys(fillIns).length > 0) {
      set((s) => ({ completedIds: { ...s.completedIds, ...fillIns } }));
    }

    // Single pass: iterate forward through `dayLogs` (today is index 0).
    // For currentChain, walk from index 0 forward until we hit a day
    // without the habit (chain broken). For longestChain, walk in
    // reverse (oldest → today) tracking running streaks.
    for (let i = 0; i < dayLogs.length; i++) {
      const present = dayLogs[i].includes(habitId);
      if (present) completedDays++;
      if (present && !chainBroken) currentChain++;
      else if (!present) chainBroken = true;
    }

    let runningChain = 0;
    for (let i = dayLogs.length - 1; i >= 0; i--) {
      if (dayLogs[i].includes(habitId)) {
        runningChain++;
        if (runningChain > longestChain) longestChain = runningChain;
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
