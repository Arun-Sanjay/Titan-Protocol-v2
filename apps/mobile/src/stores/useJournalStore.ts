import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { JournalEntry } from "../db/schema";

function journalKey(dateKey: string) {
  return `journal:${dateKey}`;
}

type JournalState = {
  entries: Record<string, JournalEntry | null>; // dateKey → entry

  loadEntry: (dateKey: string) => void;
  saveEntry: (dateKey: string, content: string) => void;
  getEntry: (dateKey: string) => JournalEntry | null;
};

export const useJournalStore = create<JournalState>()((set, get) => ({
  entries: {},

  loadEntry: (dateKey) => {
    const entry = getJSON<JournalEntry | null>(journalKey(dateKey), null);
    set((s) => ({ entries: { ...s.entries, [dateKey]: entry } }));
  },

  saveEntry: (dateKey, content) => {
    const entry: JournalEntry = {
      date_key: dateKey,
      content,
      updated_at: Date.now(),
    };
    setJSON(journalKey(dateKey), entry);
    set((s) => ({ entries: { ...s.entries, [dateKey]: entry } }));
  },

  getEntry: (dateKey) => {
    return get().entries[dateKey] ?? null;
  },
}));
