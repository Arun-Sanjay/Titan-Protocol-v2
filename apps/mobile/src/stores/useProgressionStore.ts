import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey, addDays } from "../lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Phase = "foundation" | "building" | "intensify" | "sustain";

export type PhaseHistory = {
  phase: Phase;
  startDate: string;
  endDate: string;
  stats: {
    avgScore: number;
    daysCompleted: number;
    totalDays: number;
  };
};

export type PhaseInfo = {
  phase: Phase;
  weekInPhase: number;
  totalWeeksInPhase: number | null; // null for Sustain (infinite)
  label: string;
};

// ─── Phase config ───────────────────────────────────────────────────────────

const PHASE_CONFIG: Record<Phase, { startWeek: number; endWeek: number; label: string }> = {
  foundation: { startWeek: 1, endWeek: 4, label: "FOUNDATION PHASE" },
  building:   { startWeek: 5, endWeek: 8, label: "BUILDING PHASE" },
  intensify:  { startWeek: 9, endWeek: 12, label: "INTENSIFY PHASE" },
  sustain:    { startWeek: 13, endWeek: Infinity, label: "SUSTAIN PHASE" },
};

const PHASE_ORDER: Phase[] = ["foundation", "building", "intensify", "sustain"];

// ─── MMKV key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "progression_phase";

type PersistedProgression = {
  currentPhase: Phase;
  phaseStartWeek: number;
  currentWeek: number;
  firstUseDate: string | null;
  phaseStartDate: string | null;
  phaseHistory: PhaseHistory[];
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function weeksSinceDate(dateKey: string): number {
  const start = new Date(dateKey + "T00:00:00");
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diffMs = now.getTime() - start.getTime();
  // Week 1 starts on day 0
  return Math.max(1, Math.floor(diffMs / (7 * 86_400_000)) + 1);
}

function phaseForWeek(week: number): Phase {
  if (week <= 4) return "foundation";
  if (week <= 8) return "building";
  if (week <= 12) return "intensify";
  return "sustain";
}

// ─── Store ──────────────────────────────────────────────────────────────────

type ProgressionState = {
  currentPhase: Phase;
  phaseStartWeek: number;
  currentWeek: number;
  firstUseDate: string | null;
  phaseStartDate: string | null;
  phaseHistory: PhaseHistory[];

  /** Set the first use date (during onboarding) */
  initialize: (firstUseDate: string) => void;
  /**
   * Recalculate current week from firstUseDate and check if phase should advance.
   * Returns the new phase if a transition occurred, or null.
   */
  checkWeekAdvancement: () => Phase | null;
  /** Get current phase info for dashboard display */
  getPhaseInfo: () => PhaseInfo;
  /** Load persisted state from MMKV */
  load: () => void;
};

function persist(data: PersistedProgression) {
  setJSON(STORAGE_KEY, data);
}

export const useProgressionStore = create<ProgressionState>()((set, get) => ({
  currentPhase: "foundation",
  phaseStartWeek: 1,
  currentWeek: 1,
  firstUseDate: null,
  phaseStartDate: null,
  phaseHistory: [],

  initialize: (firstUseDate) => {
    const data: PersistedProgression = {
      currentPhase: "foundation",
      phaseStartWeek: 1,
      currentWeek: 1,
      firstUseDate,
      phaseStartDate: firstUseDate,
      phaseHistory: [],
    };
    set(data);
    persist(data);
  },

  checkWeekAdvancement: () => {
    const { firstUseDate, currentPhase, phaseStartWeek, phaseHistory } = get();
    if (!firstUseDate) return null;

    const actualWeek = weeksSinceDate(firstUseDate);
    const expectedPhase = phaseForWeek(actualWeek);

    if (expectedPhase !== currentPhase) {
      // Phase transition — record history entry for the old phase
      const today = getTodayKey();
      const { phaseStartDate } = get();
      const weeksInOldPhase = actualWeek - phaseStartWeek;

      // Compute actual phase stats from protocol completions
      const totalDays = weeksInOldPhase * 7;
      let daysCompleted = 0;
      let totalScore = 0;
      for (let i = totalDays - 1; i >= 0; i--) {
        const dk = addDays(today, -i);
        const comp = getJSON<{ completed: boolean; score: number } | null>(`protocol_completions:${dk}`, null);
        if (comp && comp.completed) {
          daysCompleted++;
          totalScore += comp.score;
        }
      }

      const historyEntry: PhaseHistory = {
        phase: currentPhase,
        startDate: phaseStartDate ?? firstUseDate ?? today,
        endDate: today,
        stats: {
          avgScore: daysCompleted > 0 ? Math.round(totalScore / daysCompleted) : 0,
          daysCompleted,
          totalDays,
        },
      };

      const newHistory = [...phaseHistory, historyEntry];
      const expectedConfig = PHASE_CONFIG[expectedPhase];
      const newStartWeek = expectedConfig.startWeek;

      set({
        currentPhase: expectedPhase,
        currentWeek: actualWeek,
        phaseStartWeek: newStartWeek,
        phaseStartDate: today,
        phaseHistory: newHistory,
      });
      persist({
        currentPhase: expectedPhase,
        phaseStartWeek: newStartWeek,
        currentWeek: actualWeek,
        firstUseDate,
        phaseStartDate: today,
        phaseHistory: newHistory,
      });

      return expectedPhase;
    }

    // No phase change — just update current week
    if (actualWeek !== get().currentWeek) {
      const { currentPhase: cp, phaseStartWeek: psw, firstUseDate: fud, phaseStartDate: psd, phaseHistory: ph } = get();
      set({ currentWeek: actualWeek });
      persist({
        currentPhase: cp,
        phaseStartWeek: psw,
        currentWeek: actualWeek,
        firstUseDate: fud,
        phaseStartDate: psd,
        phaseHistory: ph,
      });
    }

    return null;
  },

  getPhaseInfo: () => {
    const { currentPhase, currentWeek, phaseStartWeek } = get();
    const config = PHASE_CONFIG[currentPhase];
    const weekInPhase = Math.max(1, currentWeek - phaseStartWeek + 1);
    const totalWeeks =
      currentPhase === "sustain"
        ? null
        : config.endWeek - config.startWeek + 1;

    return {
      phase: currentPhase,
      weekInPhase,
      totalWeeksInPhase: totalWeeks,
      label: config.label,
    };
  },

  load: () => {
    const data = getJSON<PersistedProgression>(STORAGE_KEY, {
      currentPhase: "foundation",
      phaseStartWeek: 1,
      currentWeek: 1,
      firstUseDate: null,
      phaseStartDate: null,
      phaseHistory: [],
    });
    set(data);
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectPhaseProgress(info: PhaseInfo): number {
  if (!info.totalWeeksInPhase) return 0; // Sustain has no fixed progress
  return Math.round((info.weekInPhase / info.totalWeeksInPhase) * 100);
}

export function selectPhaseLabel(info: PhaseInfo): string {
  if (!info.totalWeeksInPhase) {
    return `${info.label} — WEEK ${info.weekInPhase}`;
  }
  return `${info.label} — WEEK ${info.weekInPhase} OF ${info.totalWeeksInPhase}`;
}

export function selectNextPhase(current: Phase): Phase | null {
  const idx = PHASE_ORDER.indexOf(current);
  if (idx < 0 || idx >= PHASE_ORDER.length - 1) return null;
  return PHASE_ORDER[idx + 1];
}
