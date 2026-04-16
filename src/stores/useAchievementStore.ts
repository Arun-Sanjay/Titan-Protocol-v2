import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  xpReward: number;
  iconName: string;
};

type AchievementState = {
  unlockedIds: string[];
  definitions: Record<string, AchievementDef>;
  /** Currently displayed achievement celebration (head of queue). */
  pendingCelebration: AchievementDef | null;
  /** Queue of achievements waiting to be celebrated. */
  celebrationQueue: AchievementDef[];

  unlockAchievement: (id: string, def: AchievementDef) => void;
  isUnlocked: (id: string) => boolean;
  /** Advance the celebration queue: sets next pendingCelebration or null. */
  dismissCelebration: () => void;
};

export const useAchievementStore = create<AchievementState>((set, get) => ({
  unlockedIds: getJSON<string[]>("achievement_unlocked_ids", []),
  definitions: getJSON<Record<string, AchievementDef>>("achievement_definitions", {}),
  pendingCelebration: null,
  celebrationQueue: [],

  unlockAchievement: (id, def) => {
    set((s) => {
      if (s.unlockedIds.includes(id)) return s;
      const ids = [...s.unlockedIds, id];
      const defs = { ...s.definitions, [id]: def };
      setJSON("achievement_unlocked_ids", ids);
      setJSON("achievement_definitions", defs);
      // If nothing is currently celebrating, show immediately; otherwise queue.
      if (!s.pendingCelebration) {
        return { unlockedIds: ids, definitions: defs, pendingCelebration: def };
      }
      return {
        unlockedIds: ids,
        definitions: defs,
        celebrationQueue: [...s.celebrationQueue, def],
      };
    });
  },

  isUnlocked: (id) => get().unlockedIds.includes(id),

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
