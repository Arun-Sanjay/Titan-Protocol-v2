import { create } from "zustand";
import { getJSON, setJSON, nextId } from "../db/storage";

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
  id: number;
  dayNumber: number;
  date: string;
  type: NarrativeEntryType;
  title: string;
  body: string;
  stats?: {
    titanScore?: number;
    streak?: number;
  };
};

// ─── Store ──────────────────────────────────────────────────────────────────

type NarrativeState = {
  entries: NarrativeEntry[];

  addEntry: (entry: Omit<NarrativeEntry, "id">) => void;
  load: () => void;
};

export const useNarrativeStore = create<NarrativeState>((set) => ({
  entries: getJSON<NarrativeEntry[]>("narrative_entries", []),

  addEntry: (entryData) => {
    const id = nextId();
    const entry: NarrativeEntry = { ...entryData, id };
    set((s) => {
      const entries = [...s.entries, entry];
      setJSON("narrative_entries", entries);
      return { entries };
    });
  },

  load: () => {
    const entries = getJSON<NarrativeEntry[]>("narrative_entries", []);
    set({ entries });
  },
}));
