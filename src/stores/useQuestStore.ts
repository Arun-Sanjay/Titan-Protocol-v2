import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";

// ─── Types ─────────────────────────────────────────────────────────────────

export type QuestType = "engine" | "cross_engine" | "wildcard";

export type Quest = {
  id: string;
  templateId?: string;
  type: QuestType;
  title: string;
  description: string;
  targetType: string;
  targetEngine: string | undefined | null;
  targetValue: number;
  currentValue: number;
  xpReward: number;
  status: "active" | "completed" | "failed";
  completed: boolean;
  active: boolean;
  createdAt?: string;
};

export type BossChallenge = {
  id: string;
  title: string;
  description: string;
  requirement?: string;
  daysRequired: number;
  currentDay: number;
  dayResults: boolean[];
  active: boolean;
  completed: boolean;
  failed: boolean;
  xpReward: number;
};

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectActiveQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.active && !q.completed);
}

// ─── Store ──────────────────────────────────────────────────────────────────

type QuestState = {
  weeklyQuests: Quest[];
  bossChallenge: BossChallenge | null;

  setWeeklyQuests: (quests: Quest[]) => void;
  updateQuestProgress: (questId: string, value: number) => void;
  completeQuest: (questId: string) => void;
  setBossChallenge: (boss: BossChallenge | null) => void;
  generateWeeklyQuests: (phase: string, identity: string) => void;
};

export const useQuestStore = create<QuestState>((set, get) => ({
  weeklyQuests: getJSON<Quest[]>("weekly_quests", []),
  bossChallenge: getJSON<BossChallenge | null>("boss_challenges", null),

  setWeeklyQuests: (quests) => {
    setJSON("weekly_quests", quests);
    set({ weeklyQuests: quests });
  },

  updateQuestProgress: (questId, value) => {
    set((s) => {
      const updated = s.weeklyQuests.map((q) =>
        q.id === questId ? { ...q, currentValue: value } : q,
      );
      setJSON("weekly_quests", updated);
      return { weeklyQuests: updated };
    });
  },

  completeQuest: (questId) => {
    set((s) => {
      const updated = s.weeklyQuests.map((q) =>
        q.id === questId ? { ...q, completed: true } : q,
      );
      setJSON("weekly_quests", updated);
      return { weeklyQuests: updated };
    });
  },

  setBossChallenge: (boss) => {
    setJSON("boss_challenges", boss);
    set({ bossChallenge: boss });
  },

  generateWeeklyQuests: (phase, identity) => {
    // Delegate to quest-generator for template selection then persist.
    // Imported lazily to avoid circular dependency at module-init time.
    const { generateWeeklyQuests } = require("../lib/quest-generator");
    const recentIds = get().weeklyQuests.map((q) => q.templateId).filter(Boolean) as string[];
    const quests: Quest[] = generateWeeklyQuests(phase, identity, recentIds);
    setJSON("weekly_quests", quests);
    set({ weeklyQuests: quests });
  },
}));
