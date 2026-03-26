import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

export type FocusSettings = {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakAfter: number;
  dailyTarget: number;
};

export type FocusDaily = {
  sessionsCompleted: number;
};

const SETTINGS_KEY = "focus_settings";
function dailyKey(dateKey: string) {
  return `focus_daily:${dateKey}`;
}

const DEFAULT_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfter: 4,
  dailyTarget: 8,
};

type FocusState = {
  settings: FocusSettings;
  daily: Record<string, FocusDaily>;

  loadSettings: () => void;
  updateSettings: (settings: Partial<FocusSettings>) => void;
  loadDaily: (dateKey: string) => void;
  completeSession: (dateKey: string) => void;
  getSessions: (dateKey: string) => number;
};

export const useFocusStore = create<FocusState>()((set, get) => ({
  settings: DEFAULT_SETTINGS,
  daily: {},

  loadSettings: () => {
    set({ settings: getJSON<FocusSettings>(SETTINGS_KEY, DEFAULT_SETTINGS) });
  },

  updateSettings: (partial) => {
    const settings = { ...get().settings, ...partial };
    setJSON(SETTINGS_KEY, settings);
    set({ settings });
  },

  loadDaily: (dateKey) => {
    const d = getJSON<FocusDaily>(dailyKey(dateKey), { sessionsCompleted: 0 });
    set((s) => ({ daily: { ...s.daily, [dateKey]: d } }));
  },

  completeSession: (dateKey) => {
    const current = get().daily[dateKey] ?? { sessionsCompleted: 0 };
    const updated = { sessionsCompleted: current.sessionsCompleted + 1 };
    setJSON(dailyKey(dateKey), updated);
    set((s) => ({ daily: { ...s.daily, [dateKey]: updated } }));
  },

  getSessions: (dateKey) => {
    return get().daily[dateKey]?.sessionsCompleted ?? 0;
  },
}));
