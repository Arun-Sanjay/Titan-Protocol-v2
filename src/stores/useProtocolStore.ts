import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "../lib/date";

type ProtocolState = {
  todayCompleted: boolean;
  streakCurrent: number;
  streakBest: number;
  startedAt: string | null;
  isActive: boolean;

  markCompleted: () => void;
  setStreak: (streak: number) => void;
  refresh: () => void;
  checkTodayStatus: () => void;
  resetDaily: () => void;
};

export const useProtocolStore = create<ProtocolState>((set) => {
  const today = getTodayKey();
  return {
    todayCompleted: getJSON<boolean>(`protocol_completed_${today}`, false),
    streakCurrent: getJSON<number>("protocol_streak", 0),
    streakBest: getJSON<number>("protocol_streak_best", 0),
    startedAt: getJSON<string | null>("protocol_started_at", null),
    isActive: false,

    markCompleted: () => {
      const day = getTodayKey();
      setJSON(`protocol_completed_${day}`, true);
      set({ todayCompleted: true });
    },

    setStreak: (streak) => {
      setJSON("protocol_streak", streak);
      const best = getJSON<number>("protocol_streak_best", 0);
      if (streak > best) setJSON("protocol_streak_best", streak);
      set({
        streakCurrent: streak,
        streakBest: Math.max(streak, best),
      });
    },

    refresh: () => {
      const day = getTodayKey();
      set({
        todayCompleted: getJSON<boolean>(`protocol_completed_${day}`, false),
        streakCurrent: getJSON<number>("protocol_streak", 0),
      });
    },

    checkTodayStatus: () => {
      const day = getTodayKey();
      set({
        todayCompleted: getJSON<boolean>(`protocol_completed_${day}`, false),
        streakCurrent: getJSON<number>("protocol_streak", 0),
      });
    },

    resetDaily: () => {
      set({
        isActive: false,
        startedAt: null,
      });
      setJSON("protocol_started_at", null);
    },
  };
});
