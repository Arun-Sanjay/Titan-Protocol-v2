import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type WeightEntry = {
  dateKey: string;
  weightKg: number;
  createdAt: number;
};

// ─── Keys ───────────────────────────────────────────────────────────────────

const ENTRIES_KEY = "weight_entries";
const GOAL_KEY = "weight_goal";

// ─── Store ──────────────────────────────────────────────────────────────────

type WeightState = {
  entries: WeightEntry[];
  goalWeight: number | null;

  load: () => void;
  addEntry: (dateKey: string, weightKg: number) => void;
  setGoalWeight: (kg: number | null) => void;
  getLatest: () => WeightEntry | null;
  getChangeFromFirst: () => { change: number; startWeight: number } | null;
};

export const useWeightStore = create<WeightState>()((set, get) => ({
  entries: [],
  goalWeight: null,

  load: () => {
    const entries = getJSON<WeightEntry[]>(ENTRIES_KEY, []);
    const goalWeight = getJSON<number | null>(GOAL_KEY, null);
    // Sort by dateKey ascending
    entries.sort((a, b) => a.dateKey.localeCompare(b.dateKey));
    set({ entries, goalWeight });
  },

  addEntry: (dateKey, weightKg) => {
    const existing = get().entries;
    // Replace if same dateKey exists, otherwise append
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

  setGoalWeight: (kg) => {
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
}));
