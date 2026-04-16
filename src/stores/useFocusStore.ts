import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types (re-exported via lib/focus-helpers.ts) ───────────────────────────

export type FocusSettings = {
  focusMinutes: number;
  breakMinutes: number;
  longBreakMinutes: number;
  longBreakAfter: number;
  dailyTarget: number;
};

// ─── Store ──────────────────────────────────────────────────────────────────

type FocusSession = {
  id: number;
  startedAt: string;
  durationMinutes: number;
  completed: boolean;
};

type FocusState = {
  settings: FocusSettings;
  sessions: FocusSession[];
  totalFocusMinutes: number;

  updateSettings: (settings: Partial<FocusSettings>) => void;
  addSession: (session: Omit<FocusSession, "id">) => void;
  load: () => void;
};

const DEFAULT_SETTINGS: FocusSettings = {
  focusMinutes: 25,
  breakMinutes: 5,
  longBreakMinutes: 15,
  longBreakAfter: 4,
  dailyTarget: 8,
};

export const useFocusStore = create<FocusState>((set) => ({
  settings: getJSON<FocusSettings>("focus_settings", DEFAULT_SETTINGS),
  sessions: getJSON<FocusSession[]>("focus_sessions", []),
  totalFocusMinutes: 0,

  updateSettings: (partial) => {
    set((s) => {
      const settings = { ...s.settings, ...partial };
      setJSON("focus_settings", settings);
      return { settings };
    });
  },

  addSession: (sessionData) => {
    set((s) => {
      const id = Date.now();
      const session: FocusSession = { ...sessionData, id };
      const sessions = [...s.sessions, session];
      setJSON("focus_sessions", sessions);
      return { sessions };
    });
  },

  load: () => {
    set({
      settings: getJSON<FocusSettings>("focus_settings", DEFAULT_SETTINGS),
      sessions: getJSON<FocusSession[]>("focus_sessions", []),
    });
  },
}));
