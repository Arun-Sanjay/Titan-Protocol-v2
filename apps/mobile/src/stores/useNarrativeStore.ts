import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type NarrativeEntryType =
  | "milestone"
  | "phase"
  | "boss"
  | "achievement"
  | "identity"
  | "streak"
  | "skill";

export type NarrativeEntry = {
  id: string;
  date: string;
  dayNumber: number;
  type: NarrativeEntryType;
  title: string;
  body: string;
  stats?: {
    titanScore?: number;
    streak?: number;
    engineScores?: Record<string, number>;
  };
};

// ─── MMKV key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "narrative_entries";

// ─── Store ──────────────────────────────────────────────────────────────────

type NarrativeState = {
  entries: NarrativeEntry[];

  /** Add a new narrative entry */
  addEntry: (entry: Omit<NarrativeEntry, "id">) => void;
  /** Get all entries (newest first) */
  getEntries: () => NarrativeEntry[];
  /** Get latest N entries */
  getLatestEntries: (count: number) => NarrativeEntry[];
  /** Get entries by type */
  getEntriesByType: (type: NarrativeEntryType) => NarrativeEntry[];
  /** Load from MMKV */
  load: () => void;
};

function persist(entries: NarrativeEntry[]) {
  setJSON(STORAGE_KEY, entries);
}

let _narrativeCounter = 0;

export const useNarrativeStore = create<NarrativeState>()((set, get) => ({
  entries: [],

  addEntry: (entry) => {
    const id = `narrative_${Date.now()}_${++_narrativeCounter}`;
    const full: NarrativeEntry = { ...entry, id };
    const updated = [...get().entries, full];
    set({ entries: updated });
    persist(updated);
  },

  getEntries: () => {
    return [...get().entries].sort((a, b) => b.dayNumber - a.dayNumber);
  },

  getLatestEntries: (count) => {
    return [...get().entries]
      .sort((a, b) => b.dayNumber - a.dayNumber)
      .slice(0, count);
  },

  getEntriesByType: (type) => {
    return get().entries.filter((e) => e.type === type);
  },

  load: () => {
    const entries = getJSON<NarrativeEntry[]>(STORAGE_KEY, []);
    set({ entries });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectEntryCount(entries: NarrativeEntry[]): number {
  return entries.length;
}

export function selectMilestoneCount(entries: NarrativeEntry[]): number {
  return entries.filter((e) => e.type === "milestone").length;
}
