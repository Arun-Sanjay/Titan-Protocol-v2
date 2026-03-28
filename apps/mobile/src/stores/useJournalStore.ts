import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { JournalEntry } from "../db/schema";
import { addDays, getTodayKey } from "../lib/date";

function journalKey(dateKey: string) {
  return `journal:${dateKey}`;
}

type JournalState = {
  entries: Record<string, JournalEntry | null>; // dateKey → entry
  recentKeys: string[]; // sorted list of dateKeys with entries (newest first)

  loadEntry: (dateKey: string) => void;
  saveEntry: (dateKey: string, content: string) => void;
  deleteEntry: (dateKey: string) => void;
  getEntry: (dateKey: string) => JournalEntry | null;
  loadRecentEntries: (days?: number) => void;
};

export const useJournalStore = create<JournalState>()((set, get) => ({
  entries: {},
  recentKeys: [],

  loadEntry: (dateKey) => {
    const entry = getJSON<JournalEntry | null>(journalKey(dateKey), null);
    set((s) => ({ entries: { ...s.entries, [dateKey]: entry } }));
  },

  saveEntry: (dateKey, content) => {
    if (!content.trim()) return; // don't save empty entries
    const entry: JournalEntry = {
      date_key: dateKey,
      content,
      updated_at: Date.now(),
    };
    setJSON(journalKey(dateKey), entry);
    set((s) => {
      const newEntries = { ...s.entries, [dateKey]: entry };
      // Update recentKeys — add this dateKey if not present
      const keys = s.recentKeys.includes(dateKey)
        ? s.recentKeys
        : [dateKey, ...s.recentKeys].sort((a, b) => b.localeCompare(a));
      return { entries: newEntries, recentKeys: keys };
    });
  },

  deleteEntry: (dateKey) => {
    setJSON(journalKey(dateKey), null);
    set((s) => {
      const newEntries = { ...s.entries };
      delete newEntries[dateKey];
      return {
        entries: newEntries,
        recentKeys: s.recentKeys.filter((k) => k !== dateKey),
      };
    });
  },

  getEntry: (dateKey) => {
    return get().entries[dateKey] ?? null;
  },

  // Scan the last N days for journal entries
  loadRecentEntries: (days = 90) => {
    const today = getTodayKey();
    const newEntries: Record<string, JournalEntry> = {};
    const keys: string[] = [];

    for (let i = 0; i < days; i++) {
      const dk = addDays(today, -i);
      const entry = getJSON<JournalEntry | null>(journalKey(dk), null);
      if (entry && entry.content && entry.content.trim().length > 0) {
        newEntries[dk] = entry;
        keys.push(dk);
      }
    }

    set((s) => ({
      entries: { ...s.entries, ...newEntries },
      recentKeys: keys, // already newest-first due to loop order
    }));
  },
}));
