import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WeightEntry = {
  dateKey: string;
  weightKg: number;
  createdAt: number;
};

export type GoalProgress = {
  pct: number;
  remaining: number;
  direction: "gain" | "lose" | "maintain";
  overshot?: boolean;
};

export type WeightTrend = "gaining" | "losing" | "stable";

// ─── Keys ───────────────────────────────────────────────────────────────────

const ENTRIES_KEY = "weight_entries";
const GOAL_KEY = "weight_goal";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Validate weight is in a reasonable range */
export function isValidWeight(kg: number): boolean {
  return Number.isFinite(kg) && kg >= 20 && kg <= 500;
}

/**
 * Compute a moving average over the entries.
 * Window defaults to 7 (7-day moving average).
 * Returns an array of { dateKey, value } with smoothed weights.
 */
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
    result.push({ dateKey: entries[i].dateKey, value: +avg.toFixed(2) });
  }
  return result;
}

/**
 * Compute weekly rate of change in kg/week.
 * Uses the last 14 entries (or fewer if not available) to compute a linear trend.
 */
export function getWeeklyRate(entries: WeightEntry[]): number | null {
  if (entries.length < 2) return null;

  const recent = entries.slice(-14);
  const first = recent[0];
  const last = recent[recent.length - 1];

  // Calculate time difference in weeks
  const firstDate = new Date(first.dateKey + "T00:00:00");
  const lastDate = new Date(last.dateKey + "T00:00:00");
  const daysDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysDiff === 0) return null;

  const weeksDiff = daysDiff / 7;
  const weightDiff = last.weightKg - first.weightKg;
  return +(weightDiff / weeksDiff).toFixed(2);
}

/**
 * Estimate weeks to reach goal weight based on current rate.
 * Returns null if no goal, no rate, or moving away from goal.
 */
export function getGoalETA(
  entries: WeightEntry[],
  goalWeight: number | null,
): number | null {
  if (!goalWeight || entries.length < 2) return null;

  const rate = getWeeklyRate(entries);
  if (rate === null || rate === 0) return null;

  const current = entries[entries.length - 1].weightKg;
  const remaining = goalWeight - current;

  // Check if moving in the right direction
  if ((remaining > 0 && rate <= 0) || (remaining < 0 && rate >= 0)) return null;

  const weeks = Math.abs(remaining / rate);
  return Math.max(1, Math.round(weeks));
}

/**
 * Determine the overall trend from recent entries.
 * Uses the 7-day moving average slope.
 */
export function getTrend(entries: WeightEntry[]): WeightTrend {
  if (entries.length < 3) return "stable";

  const ma = getMovingAverage(entries, 7);
  if (ma.length < 2) return "stable";

  // Compare last 3 MA values
  const recent = ma.slice(-3);
  const first = recent[0].value;
  const last = recent[recent.length - 1].value;
  const diff = last - first;

  if (diff > 0.3) return "gaining";
  if (diff < -0.3) return "losing";
  return "stable";
}

// ─── Store ──────────────────────────────────────────────────────────────────

type WeightState = {
  entries: WeightEntry[];
  goalWeight: number | null;

  load: () => void;
  addEntry: (dateKey: string, weightKg: number) => void;
  deleteEntry: (dateKey: string) => void;
  setGoalWeight: (kg: number | null) => void;
  getLatest: () => WeightEntry | null;
  getChangeFromFirst: () => { change: number; startWeight: number } | null;
  getGoalProgress: () => GoalProgress | null;
};

export const useWeightStore = create<WeightState>()((set, get) => ({
  entries: [],
  goalWeight: null,

  load: () => {
    const entries = getJSON<WeightEntry[]>(ENTRIES_KEY, []);
    const goalWeight = getJSON<number | null>(GOAL_KEY, null);
    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    set({ entries, goalWeight });
  },

  addEntry: (dateKey, weightKg) => {
    if (!isValidWeight(weightKg)) return;

    const existing = get().entries;
    const idx = existing.findIndex((e) => e.dateKey === dateKey);
    const entry: WeightEntry = { dateKey, weightKg, createdAt: Date.now() };

    let updated: WeightEntry[];
    if (idx !== -1) {
      updated = [...existing];
      updated[idx] = entry;
    } else {
      updated = [...existing, entry];
    }
    updated.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    setJSON(ENTRIES_KEY, updated);
    set({ entries: updated });
  },

  deleteEntry: (dateKey) => {
    const updated = get().entries.filter((e) => e.dateKey !== dateKey);
    setJSON(ENTRIES_KEY, updated);
    set({ entries: updated });
  },

  setGoalWeight: (kg) => {
    if (kg !== null && !isValidWeight(kg)) return;
    setJSON(GOAL_KEY, kg);
    set({ goalWeight: kg });
  },

  getLatest: () => {
    const entries = get().entries;
    if (entries.length === 0) return null;
    return entries[entries.length - 1];
  },

  getChangeFromFirst: () => {
    const entries = get().entries;
    if (entries.length < 2) return null;
    const first = entries[0];
    const last = entries[entries.length - 1];
    return {
      change: +(last.weightKg - first.weightKg).toFixed(1),
      startWeight: first.weightKg,
    };
  },

  getGoalProgress: () => {
    const { entries, goalWeight } = get();
    if (!goalWeight || entries.length === 0) return null;
    const start = entries[0].weightKg;
    const current = entries[entries.length - 1].weightKg;
    const totalDistance = Math.abs(goalWeight - start);
    if (totalDistance === 0) return { pct: 100, remaining: 0, direction: "maintain" as const };
    const direction: "gain" | "lose" = goalWeight > start ? "gain" : "lose";
    const progress = direction === "lose" ? start - current : current - start;
    const pct = Math.min(Math.round((Math.max(progress, 0) / totalDistance) * 100), 100);
    const remaining = direction === "lose" ? current - goalWeight : goalWeight - current;
    return { pct, remaining, direction, overshot: remaining < 0 };
  },
}));
