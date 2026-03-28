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

export type SleepStats = {
  avgDuration: number;
  avgQuality: number;
  bestNightKey: string | null;
  bestDuration: number;
  totalEntries: number;
};

export type SleepConsistency = {
  avgBedtimeMinutes: number; // minutes from midnight
  avgWakeTimeMinutes: number;
  bedtimeStdDev: number; // standard deviation in minutes
  wakeStdDev: number;
  score: number; // 0-100, higher = more consistent
  trend: "improving" | "declining" | "stable";
};

export type SleepScore = {
  overall: number; // 0-100
  durationScore: number; // 0-40 (weight: 40%)
  qualityScore: number; // 0-30 (weight: 30%)
  consistencyScore: number; // 0-30 (weight: 30%)
  grade: "S" | "A" | "B" | "C" | "D" | "F";
};

export type SleepDebt = {
  totalDebtMinutes: number; // cumulative debt (target - actual)
  weekDebtMinutes: number; // debt in last 7 days
  targetMinutes: number; // 480 (8 hours)
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function storageKey(dateKey: string) {
  return `sleep:${dateKey}`;
}

/** Validate HH:MM format (00:00 - 23:59) */
export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

/** Validate quality is 1-5 */
export function isValidQuality(q: number): q is 1 | 2 | 3 | 4 | 5 {
  return Number.isInteger(q) && q >= 1 && q <= 5;
}

/**
 * Compute duration in minutes between bedtime and wakeTime (HH:MM strings).
 * Handles overnight spans: e.g. 23:00 -> 07:00 = 480 min.
 * Returns 0 when bedtime === wakeTime.
 * Caps at 1440 (24h).
 */
export function computeDurationMinutes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);

  const bedMinutes = bh * 60 + bm;
  const wakeMinutes = wh * 60 + wm;

  if (wakeMinutes >= bedMinutes) {
    const duration = wakeMinutes - bedMinutes;
    return Math.min(duration, 1440);
  }
  // Overnight: e.g. 23:00 -> 07:00
  const duration = 1440 - bedMinutes + wakeMinutes;
  return Math.min(duration, 1440);
}

/** Convert HH:MM to minutes from midnight */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

/** Format minutes-from-midnight as HH:MM */
export function minutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Compute stats for a set of sleep entries.
 */
export function getSleepStats(entries: SleepEntry[]): SleepStats {
  if (entries.length === 0) {
    return { avgDuration: 0, avgQuality: 0, bestNightKey: null, bestDuration: 0, totalEntries: 0 };
  }

  let totalDuration = 0;
  let totalQuality = 0;
  let bestNightKey: string | null = null;
  let bestDuration = 0;

  for (const e of entries) {
    totalDuration += e.durationMinutes;
    totalQuality += e.quality;
    if (e.durationMinutes > bestDuration) {
      bestDuration = e.durationMinutes;
      bestNightKey = e.dateKey;
    }
  }

  return {
    avgDuration: Math.round(totalDuration / entries.length),
    avgQuality: +(totalQuality / entries.length).toFixed(1),
    bestNightKey,
    bestDuration,
    totalEntries: entries.length,
  };
}

/**
 * Compute sleep consistency metrics.
 * Uses circular mean for bedtime (handles midnight crossing).
 */
export function getSleepConsistency(entries: SleepEntry[]): SleepConsistency | null {
  if (entries.length < 3) return null;

  // Circular mean for bedtime (handles overnight, e.g. 23:30 and 00:30)
  let sinSumBed = 0, cosSumBed = 0;
  let sinSumWake = 0, cosSumWake = 0;
  const bedMinutesArr: number[] = [];
  const wakeMinutesArr: number[] = [];

  for (const e of entries) {
    const bedMin = timeToMinutes(e.bedtime);
    const wakeMin = timeToMinutes(e.wakeTime);
    bedMinutesArr.push(bedMin);
    wakeMinutesArr.push(wakeMin);

    const bedAngle = (bedMin / 1440) * 2 * Math.PI;
    const wakeAngle = (wakeMin / 1440) * 2 * Math.PI;
    sinSumBed += Math.sin(bedAngle);
    cosSumBed += Math.cos(bedAngle);
    sinSumWake += Math.sin(wakeAngle);
    cosSumWake += Math.cos(wakeAngle);
  }

  const n = entries.length;
  const avgBedAngle = Math.atan2(sinSumBed / n, cosSumBed / n);
  const avgWakeAngle = Math.atan2(sinSumWake / n, cosSumWake / n);
  const avgBedtimeMinutes = ((avgBedAngle / (2 * Math.PI)) * 1440 + 1440) % 1440;
  const avgWakeTimeMinutes = ((avgWakeAngle / (2 * Math.PI)) * 1440 + 1440) % 1440;

  // Standard deviation (circular)
  const bedDeviations = bedMinutesArr.map((m) => {
    let diff = m - avgBedtimeMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    return diff * diff;
  });
  const wakeDeviations = wakeMinutesArr.map((m) => {
    let diff = m - avgWakeTimeMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    return diff * diff;
  });

  const bedtimeStdDev = Math.sqrt(bedDeviations.reduce((a, b) => a + b, 0) / n);
  const wakeStdDev = Math.sqrt(wakeDeviations.reduce((a, b) => a + b, 0) / n);

  // Score: lower std dev = higher consistency (max 120 min std dev maps to 0)
  const avgStdDev = (bedtimeStdDev + wakeStdDev) / 2;
  const score = Math.max(0, Math.min(100, Math.round(100 - (avgStdDev / 120) * 100)));

  // Trend: compare first half vs second half consistency
  const halfIdx = Math.floor(n / 2);
  const firstHalf = entries.slice(0, halfIdx);
  const secondHalf = entries.slice(halfIdx);

  let firstStdSum = 0, secondStdSum = 0;
  for (const e of firstHalf) {
    let diff = timeToMinutes(e.bedtime) - avgBedtimeMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    firstStdSum += Math.abs(diff);
  }
  for (const e of secondHalf) {
    let diff = timeToMinutes(e.bedtime) - avgBedtimeMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    secondStdSum += Math.abs(diff);
  }

  const firstAvgDev = firstHalf.length > 0 ? firstStdSum / firstHalf.length : 0;
  const secondAvgDev = secondHalf.length > 0 ? secondStdSum / secondHalf.length : 0;
  const devDiff = firstAvgDev - secondAvgDev;
  const trend: "improving" | "declining" | "stable" =
    devDiff > 10 ? "improving" : devDiff < -10 ? "declining" : "stable";

  return {
    avgBedtimeMinutes: Math.round(avgBedtimeMinutes),
    avgWakeTimeMinutes: Math.round(avgWakeTimeMinutes),
    bedtimeStdDev: Math.round(bedtimeStdDev),
    wakeStdDev: Math.round(wakeStdDev),
    score,
    trend,
  };
}

/**
 * Get duration bar color based on sleep hours.
 * Green: 7-9h (ideal), Yellow: 6-7h (ok), Red: <6h or >10h (bad)
 */
export function getDurationColor(minutes: number): "good" | "ok" | "bad" {
  const hours = minutes / 60;
  if (hours >= 7 && hours <= 9) return "good";
  if (hours >= 6 && hours <= 10) return "ok";
  return "bad";
}

/**
 * Compute a sleep score (0-100) for a single night.
 * Components: duration (40%), quality (30%), timing (30%)
 */
export function computeSleepScore(entry: SleepEntry, consistency?: SleepConsistency | null): SleepScore {
  // Duration score: 8h = perfect, deductions for deviation
  const hours = entry.durationMinutes / 60;
  let durationRaw: number;
  if (hours >= 7 && hours <= 9) {
    durationRaw = 100; // ideal range
  } else if (hours >= 6 && hours <= 10) {
    // Linear falloff outside ideal
    const dist = hours < 7 ? 7 - hours : hours - 9;
    durationRaw = 100 - dist * 50; // lose 50 per hour off
  } else {
    const dist = hours < 6 ? 6 - hours : hours - 10;
    durationRaw = Math.max(0, 50 - dist * 30);
  }
  const durationScore = Math.round((durationRaw / 100) * 40);

  // Quality score: map 1-5 to 0-30
  const qualityScore = Math.round(((entry.quality - 1) / 4) * 30);

  // Consistency score: use the consistency object or default to timing-based
  let consistencyScore: number;
  if (consistency) {
    consistencyScore = Math.round((consistency.score / 100) * 30);
  } else {
    // Fallback: score based on ideal bedtime (22:00-23:00)
    const bedMin = timeToMinutes(entry.bedtime);
    // Normalize: ideal is 22:00-23:00 (1320-1380 min)
    let bedDiff: number;
    if (bedMin >= 1320 && bedMin <= 1380) {
      bedDiff = 0;
    } else if (bedMin > 1380 || bedMin < 360) {
      // After 23:00 or before 6:00
      const adjustedBed = bedMin > 720 ? bedMin : bedMin + 1440;
      bedDiff = Math.abs(adjustedBed - 1350);
    } else {
      bedDiff = Math.abs(bedMin - 1350);
    }
    const timingRaw = Math.max(0, 100 - (bedDiff / 180) * 100);
    consistencyScore = Math.round((timingRaw / 100) * 30);
  }

  const overall = Math.max(0, Math.min(100, durationScore + qualityScore + consistencyScore));

  let grade: SleepScore["grade"];
  if (overall >= 90) grade = "S";
  else if (overall >= 75) grade = "A";
  else if (overall >= 60) grade = "B";
  else if (overall >= 45) grade = "C";
  else if (overall >= 30) grade = "D";
  else grade = "F";

  return { overall, durationScore, qualityScore, consistencyScore, grade };
}

/**
 * Compute sleep debt over a set of entries.
 * Target: 480 min (8 hours).
 */
export function computeSleepDebt(entries: SleepEntry[], targetMinutes: number = 480): SleepDebt {
  let totalDebt = 0;
  let weekDebt = 0;
  const weekEntries = entries.slice(-7);

  for (const e of entries) {
    totalDebt += targetMinutes - e.durationMinutes;
  }

  for (const e of weekEntries) {
    weekDebt += targetMinutes - e.durationMinutes;
  }

  return {
    totalDebtMinutes: Math.max(0, totalDebt),
    weekDebtMinutes: Math.max(0, weekDebt),
    targetMinutes,
  };
}

// ─── Store ──────────────────────────────────────────────────────────────────

type SleepState = {
  entries: Record<string, SleepEntry>;

  loadEntry: (dateKey: string) => void;
  addEntry: (entry: SleepEntry) => void;
  deleteEntry: (dateKey: string) => void;
  getRange: (startKey: string, endKey: string) => SleepEntry[];
  getEntry: (dateKey: string) => SleepEntry | null;
  getWeekSleep: (dateKey: string) => SleepEntry[];
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
    // Validate before saving
    if (!isValidTime(entry.bedtime) || !isValidTime(entry.wakeTime)) return;
    if (!isValidQuality(entry.quality)) return;
    if (entry.durationMinutes < 15 || entry.durationMinutes > 960) return; // 15min min, 16h max

    setJSON(storageKey(entry.dateKey), entry);
    set((s) => ({ entries: { ...s.entries, [entry.dateKey]: entry } }));
  },

  deleteEntry: (dateKey) => {
    setJSON(storageKey(dateKey), null);
    set((s) => {
      const updated = { ...s.entries };
      delete updated[dateKey];
      return { entries: updated };
    });
  },

  getEntry: (dateKey) => {
    const inMemory = get().entries[dateKey];
    if (inMemory) return inMemory;
    const stored = getJSON<SleepEntry | null>(storageKey(dateKey), null);
    if (stored) {
      set((s) => ({ entries: { ...s.entries, [dateKey]: stored } }));
    }
    return stored;
  },

  getWeekSleep: (dateKey) => {
    const results: SleepEntry[] = [];
    const newEntries: Record<string, SleepEntry> = {};
    const base = new Date(dateKey + "T00:00:00");

    for (let i = 6; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const key = `${y}-${m}-${day}`;

      const inMemory = get().entries[key];
      if (inMemory) {
        results.push(inMemory);
      } else {
        const stored = getJSON<SleepEntry | null>(storageKey(key), null);
        if (stored) {
          results.push(stored);
          newEntries[key] = stored;
        }
      }
    }

    if (Object.keys(newEntries).length > 0) {
      set((s) => ({ entries: { ...s.entries, ...newEntries } }));
    }

    return results;
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

      const inMemory = get().entries[key];
      if (inMemory) {
        results.push(inMemory);
      } else {
        const stored = getJSON<SleepEntry | null>(storageKey(key), null);
        if (stored) {
          results.push(stored);
          newEntries[key] = stored;
        }
      }

      current.setDate(current.getDate() + 1);
    }

    if (Object.keys(newEntries).length > 0) {
      set((s) => ({ entries: { ...s.entries, ...newEntries } }));
    }

    return results;
  },
}));
