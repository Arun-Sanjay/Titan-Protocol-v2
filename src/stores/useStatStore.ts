import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { EngineKey } from "../db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────

type EngineStats = Record<EngineKey, number>;

// ─── Store ──────────────────────────────────────────────────────────────────

type StatState = {
  stats: EngineStats;
  totalOutput: number;
  todayGains: EngineStats;

  setStats: (stats: EngineStats) => void;
  setTotalOutput: (value: number) => void;
  addGain: (engine: EngineKey, amount: number) => void;
  resetTodayGains: () => void;
  load: () => void;
};

const DEFAULT_STATS: EngineStats = { body: 0, mind: 0, money: 0, charisma: 0 };

export const useStatStore = create<StatState>((set) => ({
  stats: getJSON<EngineStats>("player_stats", DEFAULT_STATS),
  totalOutput: getJSON<number>("player_total_output", 0),
  todayGains: getJSON<EngineStats>("player_today_gains", { ...DEFAULT_STATS }),

  setStats: (stats) => {
    setJSON("player_stats", stats);
    set({ stats });
  },

  setTotalOutput: (value) => {
    setJSON("player_total_output", value);
    set({ totalOutput: value });
  },

  addGain: (engine, amount) => {
    set((s) => {
      const stats = { ...s.stats, [engine]: s.stats[engine] + amount };
      const totalOutput = s.totalOutput + amount;
      const todayGains = { ...s.todayGains, [engine]: s.todayGains[engine] + amount };
      setJSON("player_stats", stats);
      setJSON("player_total_output", totalOutput);
      setJSON("player_today_gains", todayGains);
      return { stats, totalOutput, todayGains };
    });
  },

  resetTodayGains: () => {
    const todayGains = { ...DEFAULT_STATS };
    setJSON("player_today_gains", todayGains);
    set({ todayGains });
  },

  load: () => {
    set({
      stats: getJSON<EngineStats>("player_stats", DEFAULT_STATS),
      totalOutput: getJSON<number>("player_total_output", 0),
      todayGains: getJSON<EngineStats>("player_today_gains", { ...DEFAULT_STATS }),
    });
  },
}));
