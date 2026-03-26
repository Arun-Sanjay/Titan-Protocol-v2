import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type SleepEntry = {
  dateKey: string;
  bedtime: string; // "22:30" format (HH:MM)
  wakeTime: string; // "06:30" format
  durationMinutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  notes: string;
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function storageKey(dateKey: string) {
  return `sleep:${dateKey}`;
}

/**
 * Compute duration in minutes between bedtime and wakeTime (HH:MM strings).
 * Handles overnight spans: e.g. 23:00 → 07:00 = 480 min.
 */
export function computeDurationMinutes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);

  const bedMinutes = bh * 60 + bm;
  const wakeMinutes = wh * 60 + wm;

  if (wakeMinutes > bedMinutes) {
    // Same-day: e.g. 01:00 → 09:00
    return wakeMinutes - bedMinutes;
  }
  // Overnight: e.g. 23:00 → 07:00
  return 1440 - bedMinutes + wakeMinutes;
}

// ─── Store ──────────────────────────────────────────────────────────────────

type SleepState = {
  entries: Record<string, SleepEntry>;

  loadEntry: (dateKey: string) => void;
  addEntry: (entry: SleepEntry) => void;
  getRange: (startKey: string, endKey: string) => SleepEntry[];
};

export const useSleepStore = create<SleepState>()((set, get) => ({
  entries: {},

  loadEntry: (dateKey) => {
    const entry = getJSON<SleepEntry | null>(storageKey(dateKey), null);
    if (entry) {
      set((s) => ({ entries: { ...s.entries, [dateKey]: entry } }));
    }
  },

  addEntry: (entry) => {
    setJSON(storageKey(entry.dateKey), entry);
    set((s) => ({ entries: { ...s.entries, [entry.dateKey]: entry } }));
  },

  getRange: (startKey, endKey) => {
    const results: SleepEntry[] = [];
    const current = new Date(startKey + "T00:00:00");
    const end = new Date(endKey + "T00:00:00");

    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${d}`;

      // Check in-memory first, then storage
      const inMemory = get().entries[key];
      if (inMemory) {
        results.push(inMemory);
      } else {
        const stored = getJSON<SleepEntry | null>(storageKey(key), null);
        if (stored) {
          results.push(stored);
        }
      }

      current.setDate(current.getDate() + 1);
    }
    return results;
  },
}));
