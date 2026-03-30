import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { AppMode } from "./useModeStore";
import type { IdentityArchetype } from "./useModeStore";
import type { EngineKey } from "../db/schema";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStepId =
  | "welcome"
  | "identity"
  | "goals"
  | "mode"
  | "engines"
  | "schedule"
  | "preview"
  | "complete";

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  "welcome",
  "identity",
  "goals",
  "mode",
  "engines",
  "schedule",
  "preview",
  "complete",
];

const COMPLETED_KEY = "onboarding_completed";
const GOALS_KEY = "user_goals";
const ENGINE_PRIORITY_KEY = "engine_priority";
const SCHEDULE_KEY = "user_schedule";

// ─── Store ────────────────────────────────────────────────────────────────────

type OnboardingState = {
  completed: boolean;
  stepIndex: number;

  // User selections (in-progress)
  identity: IdentityArchetype | null;
  goals: string[];
  mode: AppMode | null;
  enginePriority: EngineKey[];
  schedule: Record<string, boolean>;

  load: () => void;
  setStepIndex: (index: number) => void;
  next: () => void;
  back: () => void;
  setIdentity: (id: IdentityArchetype) => void;
  setGoals: (goals: string[]) => void;
  setMode: (mode: AppMode) => void;
  setEnginePriority: (engines: EngineKey[]) => void;
  setSchedule: (schedule: Record<string, boolean>) => void;
  finish: () => void;
};

const DEFAULT_SCHEDULE: Record<string, boolean> = {
  Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false,
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  completed: getJSON<boolean>(COMPLETED_KEY, false),
  stepIndex: 0,

  identity: null,
  goals: [],
  mode: null,
  enginePriority: ["body", "mind", "money", "general"],
  schedule: DEFAULT_SCHEDULE,

  load: () => {
    set({ completed: getJSON<boolean>(COMPLETED_KEY, false) });
  },

  setStepIndex: (index) => set({ stepIndex: index }),
  next: () => set((s) => ({ stepIndex: Math.min(s.stepIndex + 1, ONBOARDING_STEPS.length - 1) })),
  back: () => set((s) => ({ stepIndex: Math.max(s.stepIndex - 1, 0) })),

  setIdentity: (identity) => set({ identity }),
  setGoals: (goals) => set({ goals }),
  setMode: (mode) => set({ mode }),
  setEnginePriority: (enginePriority) => set({ enginePriority }),
  setSchedule: (schedule) => set({ schedule }),

  finish: () => {
    const { identity, goals, mode, enginePriority, schedule } = get();
    // Persist all selections
    setJSON(COMPLETED_KEY, true);
    setJSON(GOALS_KEY, goals);
    setJSON(ENGINE_PRIORITY_KEY, enginePriority);
    setJSON(SCHEDULE_KEY, schedule);
    // Identity & mode go via their own stores (set by caller)
    set({ completed: true });
  },
}));
