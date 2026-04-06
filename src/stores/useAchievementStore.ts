import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ──────────────────────────────────────────────────────────────────

export type AchievementRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export type AchievementDef = {
  id: string;
  name: string;
  description: string;
  rarity: AchievementRarity;
  xpReward: number;
  iconName: string;
};

export type UnlockedAchievement = {
  id: string;
  unlockedAt: string;
};

// ─── MMKV key ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "achievements_unlocked";

// ─── Store ──────────────────────────────────────────────────────────────────

type AchievementState = {
  unlockedIds: string[];
  unlockedMap: Record<string, UnlockedAchievement>;
  pendingCelebration: AchievementDef | null;
  celebrationQueue: AchievementDef[];

  /**
   * Check a list of achievement conditions. Returns array of newly unlocked IDs.
   * Each condition is { id, met } where met is a boolean.
   */
  checkAchievements: (
    conditions: { id: string; met: boolean }[],
    definitions: AchievementDef[],
  ) => string[];
  /** Directly unlock an achievement by ID */
  unlockAchievement: (id: string, definition?: AchievementDef) => void;
  /** Clear pending celebration and advance queue */
  dismissCelebration: () => void;
  /** Get next celebration from queue */
  getNextCelebration: () => AchievementDef | null;
  /** Get all unlocked achievement data */
  getUnlocked: () => UnlockedAchievement[];
  /** Check if a specific achievement is unlocked */
  isUnlocked: (id: string) => boolean;
  /** Load from MMKV */
  load: () => void;
};

function persist(map: Record<string, UnlockedAchievement>) {
  setJSON(STORAGE_KEY, map);
}

export const useAchievementStore = create<AchievementState>()((set, get) => ({
  unlockedIds: [],
  unlockedMap: {},
  pendingCelebration: null,
  celebrationQueue: [],

  checkAchievements: (conditions, definitions) => {
    const { unlockedIds, unlockedMap } = get();
    const newlyUnlocked: string[] = [];
    let lastDef: AchievementDef | null = null;
    const newMap = { ...unlockedMap };

    for (const { id, met } of conditions) {
      if (!met) continue;
      if (unlockedIds.includes(id)) continue;

      const def = definitions.find((d) => d.id === id);
      if (!def) continue;

      const now = new Date().toISOString();
      newMap[id] = { id, unlockedAt: now };
      newlyUnlocked.push(id);
      lastDef = def;
    }

    if (newlyUnlocked.length > 0) {
      const allIds = [...unlockedIds, ...newlyUnlocked];
      set({
        unlockedIds: allIds,
        unlockedMap: newMap,
        // Show the most recent (or rarest) achievement as celebration
        pendingCelebration: lastDef,
      });
      persist(newMap);
    }

    return newlyUnlocked;
  },

  unlockAchievement: (id, definition) => {
    const { unlockedIds, unlockedMap, celebrationQueue, pendingCelebration } = get();
    if (unlockedIds.includes(id)) return;

    const now = new Date().toISOString();
    const newMap = { ...unlockedMap, [id]: { id, unlockedAt: now } };
    const newIds = [...unlockedIds, id];

    if (definition) {
      if (!pendingCelebration) {
        // No current celebration — show immediately
        set({
          unlockedIds: newIds,
          unlockedMap: newMap,
          pendingCelebration: definition,
        });
      } else {
        // Queue it behind the current celebration
        set({
          unlockedIds: newIds,
          unlockedMap: newMap,
          celebrationQueue: [...celebrationQueue, definition],
        });
      }
    } else {
      set({ unlockedIds: newIds, unlockedMap: newMap });
    }
    persist(newMap);
  },

  dismissCelebration: () => {
    const { celebrationQueue } = get();
    if (celebrationQueue.length > 0) {
      // Advance queue: next item becomes pending
      const [next, ...rest] = celebrationQueue;
      set({ pendingCelebration: next, celebrationQueue: rest });
    } else {
      set({ pendingCelebration: null });
    }
  },

  getNextCelebration: () => {
    const { celebrationQueue } = get();
    return celebrationQueue[0] ?? null;
  },

  getUnlocked: () => {
    return Object.values(get().unlockedMap);
  },

  isUnlocked: (id) => {
    return get().unlockedIds.includes(id);
  },

  load: () => {
    const map = getJSON<Record<string, UnlockedAchievement>>(STORAGE_KEY, {});
    const ids = Object.keys(map);
    set({ unlockedIds: ids, unlockedMap: map });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectUnlockedByRarity(
  unlockedIds: string[],
  definitions: AchievementDef[],
): Record<AchievementRarity, AchievementDef[]> {
  const result: Record<AchievementRarity, AchievementDef[]> = {
    common: [],
    uncommon: [],
    rare: [],
    epic: [],
    legendary: [],
  };
  for (const def of definitions) {
    if (unlockedIds.includes(def.id)) {
      result[def.rarity].push(def);
    }
  }
  return result;
}

export function selectUnlockedCount(ids: string[]): number {
  return ids.length;
}
