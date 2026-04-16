import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/sleep-helpers.ts) ───────────────────────────

export type SleepEntry = {
  id?: number;
  dateKey: string;
  bedtime: string;   // "HH:MM"
  wakeTime: string;  // "HH:MM"
  durationMinutes: number;
  quality: 1 | 2 | 3 | 4 | 5;
  notes: string;
};

export type SleepScore = {
  overall: number;
  grade: "S" | "A" | "B" | "C" | "D" | "F";
  durationScore: number;
  qualityScore: number;
  consistencyScore: number;
};

export type SleepStats = {
  avgDuration: number;
  avgQuality: number;
  avgBedtime: string;
  avgWakeTime: string;
};

export type SleepConsistency = {
  score: number;
  trend: "improving" | "declining" | "stable";
  avgBedtimeMinutes: number;
  avgWakeTimeMinutes: number;
  bedtimeStdDev: number;
  wakeStdDev: number;
  bedtimeVariance: number;
  wakeTimeVariance: number;
};

export type SleepDebt = {
  weekDebtMinutes: number;
  weeklyDebt: number;
  idealHours: number;
  actualHours: number;
};

// ─── Pure helpers (re-exported via lib/sleep-helpers.ts) ─────────────────────

export function computeDurationMinutes(bedtime: string, wakeTime: string): number {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let bedMin = bh * 60 + bm;
  let wakeMin = wh * 60 + wm;
  if (wakeMin <= bedMin) wakeMin += 24 * 60; // crossed midnight
  return wakeMin - bedMin;
}

export function minutesToTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function getDurationColor(minutes: number): "good" | "ok" | "bad" {
  if (minutes >= 420 && minutes <= 540) return "good";
  if (minutes >= 360 && minutes <= 600) return "ok";
  return "bad";
}

export function isValidTime(time: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function isValidQuality(q: number): q is 1 | 2 | 3 | 4 | 5 {
  return q >= 1 && q <= 5 && Number.isInteger(q);
}

function scoreToGrade(score: number): SleepScore["grade"] {
  if (score >= 90) return "S";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

export function computeSleepScore(
  entry: SleepEntry,
  consistency?: SleepConsistency | null,
): SleepScore {
  const duration = entry.durationMinutes;
  const durationScore = Math.min(40, Math.max(0, 40 - Math.abs(duration - 480) * 0.15));
  const qualityScore = (entry.quality / 5) * 30;
  const consistencyScore = consistency ? (consistency.score / 100) * 30 : 15;
  const overall = Math.round(durationScore + qualityScore + consistencyScore);
  return {
    overall,
    grade: scoreToGrade(overall),
    durationScore: Math.round(durationScore),
    qualityScore: Math.round(qualityScore),
    consistencyScore: Math.round(consistencyScore),
  };
}

export function computeSleepDebt(entries: SleepEntry[], idealHours: number = 8): SleepDebt {
  const last7 = entries.slice(-7);
  const actualMinutes = last7.reduce((sum, e) => sum + e.durationMinutes, 0);
  const actualHours = actualMinutes / 60;
  const idealTotal = idealHours * last7.length;
  const weekDebtMinutes = Math.max(0, (idealTotal - actualHours) * 60);
  return {
    weekDebtMinutes: Math.round(weekDebtMinutes),
    weeklyDebt: Math.max(0, idealTotal - actualHours),
    idealHours: idealTotal,
    actualHours,
  };
}

export function getSleepStats(entries: SleepEntry[]): SleepStats {
  if (entries.length === 0) {
    return { avgDuration: 0, avgQuality: 0, avgBedtime: "00:00", avgWakeTime: "00:00" };
  }
  const totalDuration = entries.reduce((s, e) => s + e.durationMinutes, 0);
  const totalQuality = entries.reduce((s, e) => s + e.quality, 0);
  return {
    avgDuration: Math.round(totalDuration / entries.length),
    avgQuality: Math.round((totalQuality / entries.length) * 10) / 10,
    avgBedtime: entries[0]?.bedtime ?? "00:00",
    avgWakeTime: entries[0]?.wakeTime ?? "00:00",
  };
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance));
}

export function getSleepConsistency(entries: SleepEntry[]): SleepConsistency | null {
  if (entries.length < 3) return null;
  const bedtimes = entries.map((e) => {
    let m = timeToMinutes(e.bedtime);
    if (m < 720) m += 1440; // normalize past midnight
    return m;
  });
  const wakeTimes = entries.map((e) => timeToMinutes(e.wakeTime));
  const avgBedtime = Math.round(bedtimes.reduce((s, v) => s + v, 0) / bedtimes.length);
  const avgWake = Math.round(wakeTimes.reduce((s, v) => s + v, 0) / wakeTimes.length);
  const bedStd = stdDev(bedtimes);
  const wakeStd = stdDev(wakeTimes);
  const score = Math.max(0, Math.min(100, 100 - bedStd - wakeStd));

  return {
    score,
    trend: score >= 70 ? "stable" : score >= 50 ? "improving" : "declining",
    avgBedtimeMinutes: avgBedtime % 1440,
    avgWakeTimeMinutes: avgWake,
    bedtimeStdDev: bedStd,
    wakeStdDev: wakeStd,
    bedtimeVariance: bedStd,
    wakeTimeVariance: wakeStd,
  };
}

// ─── Store ──────────────────────────────────────────────────────────────────

type SleepState = {
  entries: SleepEntry[];
  addEntry: (entry: Omit<SleepEntry, "id">) => void;
  removeEntry: (dateKey: string) => void;
  load: () => void;
};

export const useSleepStore = create<SleepState>((set) => ({
  entries: getJSON<SleepEntry[]>("sleep_entries", []),

  addEntry: (entryData) => {
    set((s) => {
      const id = Date.now();
      const entry: SleepEntry = { ...entryData, id };
      // Replace existing entry for same dateKey
      const entries = [...s.entries.filter((e) => e.dateKey !== entry.dateKey), entry];
      setJSON("sleep_entries", entries);
      return { entries };
    });
  },

  removeEntry: (dateKey) => {
    set((s) => {
      const entries = s.entries.filter((e) => e.dateKey !== dateKey);
      setJSON("sleep_entries", entries);
      return { entries };
    });
  },

  load: () => {
    set({ entries: getJSON<SleepEntry[]>("sleep_entries", []) });
  },
}));
