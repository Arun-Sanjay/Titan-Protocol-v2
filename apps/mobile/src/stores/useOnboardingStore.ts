import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { AppMode, IdentityArchetype } from "./useModeStore";
import type { EngineKey } from "../db/schema";
import { scoreQuiz, type QuizResult } from "../lib/quiz-scoring";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingStepId =
  | "welcome"
  | "identity"
  | "reveal"
  | "goals"
  | "mode"
  | "engines"
  | "schedule"
  | "preview"
  | "complete";

export type SchedulePreference = "early_morning" | "morning" | "midday" | "evening" | "night";

export const ONBOARDING_STEPS: OnboardingStepId[] = [
  "welcome",
  "identity",
  "reveal",
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
const SCHEDULE_PREF_KEY = "schedule_preference";
const TUTORIAL_COMPLETED_KEY = "tutorial_completed";

// ─── Store ────────────────────────────────────────────────────────────────────

type OnboardingState = {
  completed: boolean;
  stepIndex: number;
  /** Alias for stepIndex used by app/onboarding.tsx */
  currentStep: number;

  // User selections (in-progress)
  identity: IdentityArchetype | null;
  quizAnswers: number[];
  quizResult: QuizResult | null;
  goals: string[];
  mode: AppMode | null;
  enginePriority: EngineKey[];
  schedule: Record<string, boolean>;
  schedulePreference: SchedulePreference | null;
  tutorialCompleted: boolean;

  load: () => void;
  setStepIndex: (index: number) => void;
  next: () => void;
  back: () => void;
  setIdentity: (id: IdentityArchetype) => void;
  setQuizAnswer: (questionIndex: number, optionIndex: number) => void;
  computeQuizResult: () => QuizResult;
  setGoals: (goals: string[]) => void;
  setMode: (mode: AppMode) => void;
  setEnginePriority: (engines: EngineKey[]) => void;
  setSchedule: (schedule: Record<string, boolean>) => void;
  setSchedulePreference: (pref: SchedulePreference) => void;
  finish: () => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
};

const DEFAULT_SCHEDULE: Record<string, boolean> = {
  Mon: true, Tue: true, Wed: true, Thu: true, Fri: true, Sat: false, Sun: false,
};

export const useOnboardingStore = create<OnboardingState>()((set, get) => ({
  completed: getJSON<boolean>(COMPLETED_KEY, false),
  stepIndex: 0,
  get currentStep() { return get().stepIndex; },

  identity: null,
  quizAnswers: [-1, -1, -1, -1, -1, -1, -1],
  quizResult: null,
  goals: [],
  mode: null,
  enginePriority: ["body", "mind", "money", "charisma"],
  schedule: DEFAULT_SCHEDULE,
  schedulePreference: getJSON<SchedulePreference | null>(SCHEDULE_PREF_KEY, null),
  tutorialCompleted: getJSON<boolean>(TUTORIAL_COMPLETED_KEY, false),

  load: () => {
    set({
      completed: getJSON<boolean>(COMPLETED_KEY, false),
      schedulePreference: getJSON<SchedulePreference | null>(SCHEDULE_PREF_KEY, null),
      tutorialCompleted: getJSON<boolean>(TUTORIAL_COMPLETED_KEY, false),
    });
  },

  setStepIndex: (index) => set({ stepIndex: index, currentStep: index }),
  next: () => set((s) => {
    const next = Math.min(s.stepIndex + 1, ONBOARDING_STEPS.length - 1);
    return { stepIndex: next, currentStep: next };
  }),
  back: () => set((s) => {
    const prev = Math.max(s.stepIndex - 1, 0);
    return { stepIndex: prev, currentStep: prev };
  }),

  setIdentity: (identity) => set({ identity }),
  setQuizAnswer: (questionIndex, optionIndex) => set((s) => {
    const answers = [...s.quizAnswers];
    answers[questionIndex] = optionIndex;
    return { quizAnswers: answers };
  }),
  computeQuizResult: () => {
    const { quizAnswers } = get();
    const result = scoreQuiz(quizAnswers);
    set({ quizResult: result, identity: result.archetype });
    return result;
  },
  setGoals: (goals) => set({ goals }),
  setMode: (mode) => set({ mode }),
  setEnginePriority: (enginePriority) => set({ enginePriority }),
  setSchedule: (schedule) => set({ schedule }),

  setSchedulePreference: (pref) => {
    setJSON(SCHEDULE_PREF_KEY, pref);
    set({ schedulePreference: pref });
  },

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

  completeTutorial: () => {
    setJSON(TUTORIAL_COMPLETED_KEY, true);
    set({ tutorialCompleted: true });
  },

  resetTutorial: () => {
    setJSON(TUTORIAL_COMPLETED_KEY, false);
    set({ tutorialCompleted: false });
  },
}));
