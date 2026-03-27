import { create } from "zustand";
import { getJSON, setJSON, storage } from "../db/storage";

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
 * Returns 0 when bedtime === wakeTime.
 * Caps at 1440 (24h).
 */
export function computeDurationMinutes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);

  const bedMinutes = bh * 60 + bm;
  const wakeMinutes = wh * 60 + wm;

  // Bug 1: bedtime == wakeTime should produce 0, not 1440
  if (wakeMinutes >= bedMinutes) {
    // Same-day: e.g. 01:00 → 09:00, or equal times → 0
    const duration = wakeMinutes - bedMinutes;
    // Bug 2: cap at 24h
    if (duration > 1440) return 1440;
    return duration;
  }
  // Overnight: e.g. 23:00 → 07:00
  const duration = 1440 - bedMinutes + wakeMinutes;
  // Bug 2: cap at 24h
  if (duration > 1440) return 1440;
  return duration;
}

// ─── Store ──────────────────────────────────────────────────────────────────

type SleepState = {
  entries: Record<string, SleepEntry>;

  loadEntry: (dateKey: string) => void;
  addEntry: (entry: SleepEntry) => void;
  deleteEntry: (dateKey: string) => void;
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

  // Bug 3: Add deleteEntry action
  deleteEntry: (dateKey) => {
    storage.set(storageKey(dateKey), "");
    set((s) => {
      const updated = { ...s.entries };
      delete updated[dateKey];
      return { entries: updated };
    });
  },

  getRange: (startKey, endKey) => {
    const results: SleepEntry[] = [];
    const newEntries: Record<string, SleepEntry> = {};
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
          // Bug 4: populate cache with newly loaded data
          newEntries[key] = stored;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    // Bug 4: update in-memory entries with newly loaded data
    if (Object.keys(newEntries).length > 0) {
      set((s) => ({ entries: { ...s.entries, ...newEntries } }));
    }

    return results;
  },
}));
