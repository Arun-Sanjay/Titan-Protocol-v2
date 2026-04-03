import { create } from "zustand";
import {
  getStats,
  getTotalOutput,
  getTodayGains,
  recordDailyStats,
  checkStatMilestones,
  initializeStats,
} from "../lib/stats";
import type { EngineKey } from "../db/schema";

type StatState = {
  stats: Record<EngineKey, number>;
  totalOutput: number;
  todayGains: Record<EngineKey, number>;
  initialized: boolean;

  load: (dateKey: string) => void;
  initialize: (archetype: string) => void;
  recordDaily: (
    dateKey: string,
    engineScores: Record<EngineKey, number>,
  ) => Array<{ engine: EngineKey; milestone: number }>;
};

const EMPTY: Record<EngineKey, number> = {
  body: 0,
  mind: 0,
  money: 0,
  charisma: 0,
};

export const useStatStore = create<StatState>()((set, _get) => ({
  stats: { ...EMPTY },
  totalOutput: 0,
  todayGains: { ...EMPTY },
  initialized: false,

  load: (dateKey) => {
    const stats = getStats();
    const totalOutput = getTotalOutput();
    const todayGains = getTodayGains(dateKey);
    set({ stats, totalOutput, todayGains, initialized: true });
  },

  initialize: (archetype) => {
    initializeStats(archetype);
    const stats = getStats();
    const totalOutput = getTotalOutput();
    set({ stats, totalOutput, initialized: true });
  },

  recordDaily: (dateKey, engineScores) => {
    recordDailyStats(dateKey, engineScores);
    const milestones = checkStatMilestones(dateKey);
    const stats = getStats();
    const totalOutput = getTotalOutput();
    const todayGains = getTodayGains(dateKey);
    set({ stats, totalOutput, todayGains });
    return milestones;
  },
}));
