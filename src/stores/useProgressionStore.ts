import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

export type Phase = "foundation" | "building" | "intensify" | "sustain";

type PhaseInfo = {
  name: string;
  weekRange: string;
  description: string;
};

const PHASE_INFO: Record<Phase, PhaseInfo> = {
  foundation: { name: "Foundation", weekRange: "1-4", description: "Build your first habits" },
  building: { name: "Building", weekRange: "5-8", description: "Solidify routines" },
  intensify: { name: "Intensify", weekRange: "9-12", description: "Push harder" },
  sustain: { name: "Sustain", weekRange: "13+", description: "Maintain & grow" },
};

type ProgressionState = {
  currentPhase: Phase;
  weekNumber: number;
  setPhase: (phase: Phase) => void;
  setWeek: (week: number) => void;
  getPhaseInfo: () => PhaseInfo;
  checkWeekAdvancement: () => void;
};

// ─── Selectors (pure functions, importable without the hook) ────────────────

export function selectPhaseLabel(info: PhaseInfo): string {
  return `${info.name.toUpperCase()} · WEEKS ${info.weekRange}`;
}

export function selectPhaseProgress(info: PhaseInfo): number {
  // Parse week range to compute progress within a phase
  const [start, end] = info.weekRange.split("-").map((s) => parseInt(s.replace("+", ""), 10));
  if (!end || isNaN(end)) return 100; // "13+" sustain — always full
  const span = end - start + 1;
  // Return a default mid-phase progress (real value computed from weekNumber)
  return Math.round((1 / span) * 100);
}

export const useProgressionStore = create<ProgressionState>((set, get) => ({
  currentPhase: getJSON<Phase>("progression_phase", "foundation"),
  weekNumber: getJSON<number>("progression_week", 1),

  setPhase: (phase) => {
    setJSON("progression_phase", phase);
    set({ currentPhase: phase });
  },

  setWeek: (week) => {
    setJSON("progression_week", week);
    set({ weekNumber: week });
  },

  getPhaseInfo: () => PHASE_INFO[get().currentPhase],

  checkWeekAdvancement: () => {
    const week = get().weekNumber;
    let phase: Phase;
    if (week <= 4) phase = "foundation";
    else if (week <= 8) phase = "building";
    else if (week <= 12) phase = "intensify";
    else phase = "sustain";
    if (phase !== get().currentPhase) {
      setJSON("progression_phase", phase);
      set({ currentPhase: phase });
    }
  },
}));
