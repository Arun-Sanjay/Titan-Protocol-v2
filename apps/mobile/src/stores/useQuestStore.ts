import { create } from "zustand";
import { getJSON, setJSON } from "../db/storage";
import { getTodayKey } from "../lib/date";
import { generateWeeklyQuests as generateFromTemplates } from "../lib/quest-generator";
import bossDefinitions from "../data/boss-challenges.json";

type BossDef = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  phase: string;
  unlockWeek: number | null;
  daysRequired: number;
  xpReward: number;
  titanOnly: boolean;
  evaluator: string;
  evaluatorThreshold: number;
  evaluatorEngine?: string;
};

const BOSS_DEFS = bossDefinitions as BossDef[];

// ─── Types ──────────────────────────────────────────────────────────────────

export type QuestType = "engine" | "cross_engine" | "wildcard";
export type QuestStatus = "active" | "completed" | "failed";

export type Quest = {
  id: string;
  templateId?: string;
  type: QuestType;
  title: string;
  description: string;
  targetEngine?: string;
  targetType: "score" | "streak" | "completion" | "rank";
  targetValue: number;
  currentValue: number;
  xpReward: number;
  status: QuestStatus;
  createdAt: string;
  completedAt?: string;
};

export type BossChallenge = {
  id: string;
  title: string;
  description: string;
  requirement: string;
  daysRequired: number;
  currentDay: number;
  dayResults: boolean[];
  xpReward: number;
  active: boolean;
  completed: boolean;
  failed: boolean;
  startedAt?: string;
  completedAt?: string;
};

// ─── MMKV keys ──────────────────────────────────────────────────────────────

function weekKey(dateKey: string): string {
  // Get Monday of the week for this date
  const d = new Date(dateKey + "T00:00:00");
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `weekly_quests:${y}-${m}-${dd}`;
}

const BOSS_KEY = "boss_challenges";
const BOSS_PROGRESS_PREFIX = "boss_progress:";

// ─── Store ──────────────────────────────────────────────────────────────────

type QuestState = {
  weeklyQuests: Quest[];
  bossChallenge: BossChallenge | null;
  weekLoaded: string | null;

  /** Generate 3 weekly quests from templates */
  generateWeeklyQuests: (phase: string, identity: string) => void;
  /** Update progress on a quest */
  updateQuestProgress: (questId: string, value: number) => void;
  /** Mark a quest as completed */
  completeQuest: (questId: string) => void;
  /** Start a boss challenge */
  startBossChallenge: (challenge: Omit<BossChallenge, "active" | "completed" | "failed" | "currentDay" | "dayResults" | "startedAt" | "completedAt">) => void;
  /** Record a day's result for the active boss challenge */
  updateBossProgress: (dayPassed: boolean) => void;
  /** Clear boss challenge from state (after claiming reward) */
  clearBoss: () => void;
  /** Get the next available boss for current phase/week/mode */
  getAvailableBoss: (phase: string, currentWeek: number, isTitanMode: boolean) => BossDef | null;
  /** Evaluate if today passes the active boss challenge */
  evaluateBossDay: (engineScores: Record<string, number>, primaryEngine: string, protocolStreak: number) => boolean;
  /** Load from MMKV */
  load: () => void;
};

function persistQuests(quests: Quest[], wk: string) {
  setJSON(wk, quests);
}

function persistBoss(challenge: BossChallenge | null) {
  setJSON(BOSS_KEY, challenge);
  if (challenge) {
    setJSON(BOSS_PROGRESS_PREFIX + challenge.id, {
      day: challenge.currentDay,
      results: challenge.dayResults,
    });
  }
}

export const useQuestStore = create<QuestState>()((set, get) => ({
  weeklyQuests: [],
  bossChallenge: null,
  weekLoaded: null,

  generateWeeklyQuests: (phase, identity) => {
    const today = getTodayKey();
    const wk = weekKey(today);

    // Check if quests already exist for this week
    const existing = getJSON<Quest[]>(wk, []);
    if (existing.length > 0) {
      set({ weeklyQuests: existing, weekLoaded: wk });
      return;
    }

    // Get recent quest IDs to avoid repeats (last 2 weeks)
    const lastWeekDate = new Date(today + "T00:00:00");
    lastWeekDate.setDate(lastWeekDate.getDate() - 7);
    const lastWk = weekKey(`${lastWeekDate.getFullYear()}-${String(lastWeekDate.getMonth() + 1).padStart(2, "0")}-${String(lastWeekDate.getDate()).padStart(2, "0")}`);
    const lastWeekQuests = getJSON<Quest[]>(lastWk, []);
    const recentIds = lastWeekQuests.map((q) => q.templateId).filter(Boolean) as string[];

    const quests = generateFromTemplates(phase, identity, recentIds);

    set({ weeklyQuests: quests, weekLoaded: wk });
    persistQuests(quests, wk);
  },

  updateQuestProgress: (questId, value) => {
    const { weeklyQuests, weekLoaded } = get();
    const updated = weeklyQuests.map((q) => {
      if (q.id !== questId || q.status !== "active") return q;
      const newValue = Math.min(value, q.targetValue);
      const completed = newValue >= q.targetValue;
      return {
        ...q,
        currentValue: newValue,
        status: completed ? ("completed" as QuestStatus) : q.status,
        completedAt: completed ? getTodayKey() : undefined,
      };
    });
    set({ weeklyQuests: updated });
    if (weekLoaded) persistQuests(updated, weekLoaded);
  },

  completeQuest: (questId) => {
    const { weeklyQuests, weekLoaded } = get();
    const updated = weeklyQuests.map((q) =>
      q.id === questId
        ? { ...q, status: "completed" as QuestStatus, currentValue: q.targetValue, completedAt: getTodayKey() }
        : q,
    );
    set({ weeklyQuests: updated });
    if (weekLoaded) persistQuests(updated, weekLoaded);
  },

  startBossChallenge: (challenge) => {
    const boss: BossChallenge = {
      ...challenge,
      currentDay: 0,
      dayResults: [],
      active: true,
      completed: false,
      failed: false,
      startedAt: getTodayKey(),
    };
    set({ bossChallenge: boss });
    persistBoss(boss);
  },

  updateBossProgress: (dayPassed) => {
    const { bossChallenge } = get();
    if (!bossChallenge || !bossChallenge.active) return;

    const newDay = bossChallenge.currentDay + 1;
    const newResults = [...bossChallenge.dayResults, dayPassed];

    if (!dayPassed) {
      // Failed — keep dayResults for display, reset counter, make retryable
      const failed: BossChallenge = {
        ...bossChallenge,
        currentDay: 0,
        dayResults: newResults, // Keep results so dotFailed renders
        failed: true,
        active: false,
      };
      set({ bossChallenge: failed });
      persistBoss(failed);
      return;
    }

    if (newDay >= bossChallenge.daysRequired) {
      // Completed!
      const completed: BossChallenge = {
        ...bossChallenge,
        currentDay: newDay,
        dayResults: newResults,
        completed: true,
        active: false,
        completedAt: getTodayKey(),
      };
      set({ bossChallenge: completed });
      persistBoss(completed);
      return;
    }

    // In progress
    const updated: BossChallenge = {
      ...bossChallenge,
      currentDay: newDay,
      dayResults: newResults,
    };
    set({ bossChallenge: updated });
    persistBoss(updated);
  },

  clearBoss: () => {
    set({ bossChallenge: null });
    setJSON(BOSS_KEY, null);
  },

  getAvailableBoss: (phase, currentWeek, isTitanMode) => {
    const { bossChallenge } = get();
    // If a boss is already active or just completed, don't offer another
    if (bossChallenge && (bossChallenge.active || bossChallenge.completed)) return null;

    // Get completed boss IDs from MMKV
    const completedBossIds = getJSON<string[]>("completed_boss_ids", []);

    for (const def of BOSS_DEFS) {
      // Skip already completed bosses
      if (completedBossIds.includes(def.id)) continue;
      // Titan-only bosses require titan mode
      if (def.titanOnly && !isTitanMode) continue;
      // Phase-gated bosses require matching phase and week
      if (def.phase !== "titan") {
        if (def.phase !== phase) continue;
        if (def.unlockWeek !== null && currentWeek < def.unlockWeek) continue;
      }
      return def;
    }
    return null;
  },

  evaluateBossDay: (engineScores, primaryEngine, protocolStreak) => {
    const { bossChallenge } = get();
    if (!bossChallenge || !bossChallenge.active) return false;

    // Find the boss definition
    const def = BOSS_DEFS.find((d) => d.id === bossChallenge.id);
    if (!def) return false;

    const engines = ["body", "mind", "money", "charisma"];

    switch (def.evaluator) {
      case "all_engines_rank":
        return engines.every((e) => (engineScores[e] ?? 0) >= def.evaluatorThreshold);

      case "primary_a_others_b": {
        const primaryOk = (engineScores[primaryEngine] ?? 0) >= def.evaluatorThreshold;
        const othersOk = engines
          .filter((e) => e !== primaryEngine)
          .every((e) => (engineScores[e] ?? 0) >= 50);
        return primaryOk && othersOk;
      }

      case "single_engine_threshold": {
        const eng = def.evaluatorEngine ?? "mind";
        return (engineScores[eng] ?? 0) >= def.evaluatorThreshold;
      }

      case "protocol_streak":
        return protocolStreak >= def.evaluatorThreshold;

      default:
        return false;
    }
  },

  load: () => {
    const today = getTodayKey();
    const wk = weekKey(today);
    const quests = getJSON<Quest[]>(wk, []);
    const boss = getJSON<BossChallenge | null>(BOSS_KEY, null);
    set({ weeklyQuests: quests, bossChallenge: boss, weekLoaded: wk });
  },
}));

// ─── Selectors ──────────────────────────────────────────────────────────────

export function selectActiveQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.status === "active");
}

export function selectCompletedQuests(quests: Quest[]): Quest[] {
  return quests.filter((q) => q.status === "completed");
}

export function selectQuestProgress(quest: Quest): number {
  if (quest.targetValue === 0) return 0;
  return Math.round((quest.currentValue / quest.targetValue) * 100);
}
