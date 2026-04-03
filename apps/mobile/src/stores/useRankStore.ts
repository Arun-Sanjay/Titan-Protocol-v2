import { create } from "zustand";
import { loadRank, evaluateRankDay } from "../lib/ranks-v2";
import type { Rank } from "../lib/ranks-v2";

type RankStoreState = {
  rank: Rank;
  qualifyingDays: number;
  consecutiveDaysBelow: number;

  load: () => void;
  evaluateDay: (titanScore: number) => {
    promoted: boolean;
    newRank?: Rank;
    warning: boolean;
    demoted: boolean;
    demotedTo?: Rank;
  };
};

export const useRankStore = create<RankStoreState>()((set, _get) => ({
  rank: "E",
  qualifyingDays: 0,
  consecutiveDaysBelow: 0,

  load: () => {
    const state = loadRank();
    set({
      rank: state.rank,
      qualifyingDays: state.qualifyingDays,
      consecutiveDaysBelow: state.consecutiveDaysBelow,
    });
  },

  evaluateDay: (titanScore) => {
    const result = evaluateRankDay(titanScore);
    // Re-read persisted state after evaluation
    const state = loadRank();
    set({
      rank: state.rank,
      qualifyingDays: state.qualifyingDays,
      consecutiveDaysBelow: state.consecutiveDaysBelow,
    });
    return result;
  },
}));
