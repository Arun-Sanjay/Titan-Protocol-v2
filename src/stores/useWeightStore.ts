import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/weight-helpers.ts) ──────────────────────────

export type WeightEntry = {
  id?: number;
  dateKey: string;
  weightKg: number;
  createdAt?: number;
};

export type GoalProgress = {
  pct: number;
  remaining: number;
  direction: "gain" | "lose" | "maintain";
  overshot?: boolean;
};

export type WeightTrend = "gaining" | "losing" | "stable";

// ─── Pure helpers (re-exported via lib/weight-helpers.ts) ────────────────────

export function getMovingAverage(
  entries: WeightEntry[],
  window: number = 7,
): { dateKey: string; value: number }[] {
  if (entries.length === 0) return [];
  const result: { dateKey: string; value: number }[] = [];
  for (let i = 0; i < entries.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = entries.slice(start, i + 1);
    const avg = slice.reduce((sum, e) => sum + e.weightKg, 0) / slice.length;
    result.push({
      dateKey: entries[i].dateKey,
      value: Math.round(avg * 10) / 10,
    });
  }
  return result;
}

export function getWeeklyRate(entries: WeightEntry[]): number | null {
  if (entries.length < 2) return null;
  const first = entries[0];
  const last = entries[entries.length - 1];
  const d1 = new Date(first.dateKey + "T00:00:00");
  const d2 = new Date(last.dateKey + "T00:00:00");
  const days = (d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 1) return null;
  return Math.round(((last.weightKg - first.weightKg) / days) * 7 * 10) / 10;
}

export function getGoalETA(
  entries: WeightEntry[],
  targetKg: number | null,
): number | null {
  if (!targetKg || entries.length < 7) return null;
  const rate = getWeeklyRate(entries);
  if (rate === null || rate === 0) return null;
  const current = entries[entries.length - 1].weightKg;
  const remaining = targetKg - current;
  if ((remaining > 0 && rate <= 0) || (remaining < 0 && rate >= 0)) return null;
  return Math.round(Math.abs(remaining / rate));
}

export function getTrend(entries: WeightEntry[]): WeightTrend {
  const rate = getWeeklyRate(entries);
  if (rate === null) return "stable";
  if (rate > 0.2) return "gaining";
  if (rate < -0.2) return "losing";
  return "stable";
}

export function isValidWeight(kg: number): boolean {
  return kg >= 20 && kg <= 500;
}

// ─── Store ──────────────────────────────────────────────────────────────────

type WeightState = {
  entries: WeightEntry[];
  goalKg: number | null;

  addEntry: (entry: Omit<WeightEntry, "id">) => void;
  removeEntry: (dateKey: string) => void;
  setGoal: (kg: number | null) => void;
  load: () => void;
};

export const useWeightStore = create<WeightState>((set) => ({
  entries: getJSON<WeightEntry[]>("weight_entries", []),
  goalKg: getJSON<number | null>("weight_goal", null),

  addEntry: (entryData) => {
    set((s) => {
      const id = Date.now();
      const entry: WeightEntry = { ...entryData, id };
      const entries = [...s.entries.filter((e) => e.dateKey !== entry.dateKey), entry]
        .sort((a, b) => a.dateKey.localeCompare(b.dateKey));
      setJSON("weight_entries", entries);
      return { entries };
    });
  },

  removeEntry: (dateKey) => {
    set((s) => {
      const entries = s.entries.filter((e) => e.dateKey !== dateKey);
      setJSON("weight_entries", entries);
      return { entries };
    });
  },

  setGoal: (kg) => {
    setJSON("weight_goal", kg);
    set({ goalKg: kg });
  },

  load: () => {
    set({
      entries: getJSON<WeightEntry[]>("weight_entries", []),
      goalKg: getJSON<number | null>("weight_goal", null),
    });
  },
}));
