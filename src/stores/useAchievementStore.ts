import { create } from "zustand";

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  xpReward: number;
  iconName: string;
};

/**
 * UI-only celebration queue for newly unlocked achievements. The
 * source of truth for which achievements are unlocked lives in the
 * `achievements_unlocked` Supabase table (read via useUnlockedAchievements).
 * This store only holds transient toast state so multiple unlocks
 * from the same check pass can animate in sequence.
 */
type AchievementUIState = {
  pendingCelebration: AchievementDef | null;
  celebrationQueue: AchievementDef[];
  pushCelebration: (def: AchievementDef) => void;
  dismissCelebration: () => void;
};

export const useAchievementStore = create<AchievementUIState>((set) => ({
  pendingCelebration: null,
  celebrationQueue: [],

  pushCelebration: (def) => {
    set((s) => {
      if (!s.pendingCelebration) {
        return { pendingCelebration: def };
      }
      return { celebrationQueue: [...s.celebrationQueue, def] };
    });
  },

  dismissCelebration: () => {
    set((s) => {
      const [next, ...rest] = s.celebrationQueue;
      return {
        pendingCelebration: next ?? null,
        celebrationQueue: rest,
      };
    });
  },
}));
