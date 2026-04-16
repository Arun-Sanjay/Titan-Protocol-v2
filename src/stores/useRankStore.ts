import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import type { Rank } from "../lib/ranks-v2";

// ─── Store ──────────────────────────────────────────────────────────────────

type RankState = {
  rank: Rank;
  qualifyingDays: number;
  consecutiveDaysBelow: number;

  setRank: (rank: Rank) => void;
  setQualifyingDays: (days: number) => void;
  setConsecutiveDaysBelow: (days: number) => void;
  load: () => void;
};

export const useRankStore = create<RankState>((set) => ({
  rank: getJSON<Rank>("player_rank_current", "initiate"),
  qualifyingDays: getJSON<number>("player_rank_qualifying", 0),
  consecutiveDaysBelow: getJSON<number>("player_rank_days_below", 0),

  setRank: (rank) => {
    setJSON("player_rank_current", rank);
    set({ rank });
  },

  setQualifyingDays: (days) => {
    setJSON("player_rank_qualifying", days);
    set({ qualifyingDays: days });
  },

  setConsecutiveDaysBelow: (days) => {
    setJSON("player_rank_days_below", days);
    set({ consecutiveDaysBelow: days });
  },

  load: () => {
    set({
      rank: getJSON<Rank>("player_rank_current", "initiate"),
      qualifyingDays: getJSON<number>("player_rank_qualifying", 0),
      consecutiveDaysBelow: getJSON<number>("player_rank_days_below", 0),
    });
  },
}));
