import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

// ─── Types ─────────────────────────────────────────────────────────────────

export type SchedulePreference = "early_morning" | "morning" | "midday" | "evening" | "night" | "flexible";

type OnboardingState = {
  completed: boolean;
  identity: string;
  schedulePreference: SchedulePreference;
  enginePriority: EngineKey[];
  goals: string[];
  tutorialCompleted: boolean;

  finish: () => void;
  setEnginePriority: (engines: EngineKey[]) => void;
  setSchedule: (schedule: Record<string, boolean>) => void;
  setSchedulePreference: (pref: SchedulePreference) => void;
  completeTutorial: () => void;
  resetTutorial: () => void;
};

export const useOnboardingStore = create<OnboardingState>((set) => ({
  completed: getJSON<boolean>("onboarding_completed", false),
  identity: getJSON<string>("onboarding_identity", ""),
  schedulePreference: getJSON<SchedulePreference>("onboarding_schedule_pref", "morning"),
  enginePriority: getJSON<EngineKey[]>("onboarding_engine_priority", [
    "body",
    "mind",
    "money",
    "charisma",
  ]),
  goals: getJSON<string[]>("onboarding_goals", []),
  tutorialCompleted: getJSON<boolean>("tutorial_completed", false),

  finish: () => {
    setJSON("onboarding_completed", true);
    set({ completed: true });
  },

  setEnginePriority: (engines) => {
    setJSON("onboarding_engine_priority", engines);
    set({ enginePriority: engines });
  },

  setSchedule: (schedule) => {
    setJSON("onboarding_schedule", schedule);
  },

  setSchedulePreference: (pref) => {
    setJSON("onboarding_schedule_pref", pref);
    set({ schedulePreference: pref });
  },

  completeTutorial: () => {
    setJSON("tutorial_completed", true);
    set({ tutorialCompleted: true });
  },

  resetTutorial: () => {
    setJSON("tutorial_completed", false);
    set({ tutorialCompleted: false });
  },
}));
