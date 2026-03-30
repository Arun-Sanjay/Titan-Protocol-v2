import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey, addDays } from "../lib/date";

// ─── MMKV key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "titan_mode";

const REQUIRED_DAYS = 30;
const REQUIRED_SCORE = 85;

type PersistedTitanMode = {
  unlocked: boolean;
  consecutiveDays: number;
  averageScore: number;
  startDate: string | null;
  lastRecordedDate: string | null;
};

// ─── Store ──────────────────────────────────────────────────────────────────

type TitanModeState = {
  unlocked: boolean;
  consecutiveDays: number;
  averageScore: number;
  startDate: string | null;
  lastRecordedDate: string | null;

  /**
   * Record a day's Titan Score. Only counts if mode is full_protocol
   * and score >= 85. Otherwise resets the streak.
   */
  recordDay: (titanScore: number, mode: string) => void;
  /** Check if unlock threshold reached (30 consecutive days) */
  checkUnlock: () => boolean;
  /** Reset progress (for testing) */
  reset: () => void;
  load: () => void;
};

function persist(data: PersistedTitanMode) {
  setJSON(STORAGE_KEY, data);
}

export const useTitanModeStore = create<TitanModeState>()((set, get) => ({
  unlocked: false,
  consecutiveDays: 0,
  averageScore: 0,
  startDate: null,
  lastRecordedDate: null,

  recordDay: (titanScore, mode) => {
    const state = get();

    // Already unlocked — no need to track progress
    if (state.unlocked) return;

    const today = getTodayKey();

    // Guard against double-recording on the same day
    if (state.lastRecordedDate === today) return;

    // Must be in full_protocol mode and score >= 85
    if (mode !== "full_protocol" || titanScore < REQUIRED_SCORE) {
      set({ consecutiveDays: 0, averageScore: 0, startDate: null, lastRecordedDate: today });
      persist({ unlocked: false, consecutiveDays: 0, averageScore: 0, startDate: null, lastRecordedDate: today });
      return;
    }

    // Check if lastRecordedDate was yesterday (true consecutive)
    const isConsecutive = state.lastRecordedDate === null || addDays(state.lastRecordedDate, 1) === today;
    const baseDays = isConsecutive ? state.consecutiveDays : 0;
    const newDays = baseDays + 1;
    // Running average: ((oldAvg * oldDays) + newScore) / newDays
    const newAvg =
      baseDays === 0
        ? titanScore
        : (state.averageScore * baseDays + titanScore) / newDays;
    const newStart = isConsecutive ? (state.startDate ?? today) : today;

    const roundedAvg = Math.round(newAvg * 100) / 100;
    const isUnlocked = newDays >= REQUIRED_DAYS;

    set({
      consecutiveDays: newDays,
      averageScore: roundedAvg,
      startDate: newStart,
      lastRecordedDate: today,
      unlocked: isUnlocked,
    });
    persist({
      unlocked: isUnlocked,
      consecutiveDays: newDays,
      averageScore: roundedAvg,
      startDate: newStart,
      lastRecordedDate: today,
    });
  },

  checkUnlock: () => {
    const { consecutiveDays, unlocked } = get();
    if (unlocked) return true;
    if (consecutiveDays >= REQUIRED_DAYS) {
      set({ unlocked: true });
      const state = get();
      persist({
        unlocked: true,
        consecutiveDays: state.consecutiveDays,
        averageScore: state.averageScore,
        startDate: state.startDate,
        lastRecordedDate: state.lastRecordedDate,
      });
      return true;
    }
    return false;
  },

  reset: () => {
    set({ unlocked: false, consecutiveDays: 0, averageScore: 0, startDate: null, lastRecordedDate: null });
    persist({ unlocked: false, consecutiveDays: 0, averageScore: 0, startDate: null, lastRecordedDate: null });
  },

  load: () => {
    const data = getJSON<PersistedTitanMode>(STORAGE_KEY, {
      unlocked: false,
      consecutiveDays: 0,
      averageScore: 0,
      startDate: null,
      lastRecordedDate: null,
    });
    set(data);
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectUnlockProgress(days: number): number {
  return Math.min(100, Math.round((days / REQUIRED_DAYS) * 100));
}

export function selectDaysRemaining(days: number): number {
  return Math.max(0, REQUIRED_DAYS - days);
}
