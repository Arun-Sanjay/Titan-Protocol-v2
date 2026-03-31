/**
 * Achievement condition evaluation
 *
 * Checks all achievement conditions against current app state.
 * Returns list of newly unlocked achievement IDs.
 */

import { useProtocolStore } from "../stores/useProtocolStore";
import { useIdentityStore } from "../stores/useIdentityStore";
import { useMindTrainingStore } from "../stores/useMindTrainingStore";
import { useSkillTreeStore } from "../stores/useSkillTreeStore";
import { useTitanModeStore } from "../stores/useTitanModeStore";
import { useProgressionStore } from "../stores/useProgressionStore";
import { useAchievementStore, type AchievementDef } from "../stores/useAchievementStore";
import { useHabitStore } from "../stores/useHabitStore";
import { getJSON } from "../db/storage";
import { getTodayKey, addDays } from "./date";
import achievementDefs from "../data/achievements.json";

// ─── Types ──────────────────────────────────────────────────────────────────

type AchDef = {
  id: string;
  name: string;
  description: string;
  rarity: string;
  xpReward: number;
  conditionType: string;
  conditionValue: number | string;
  conditionEngine?: string;
  conditionThreshold?: number;
  conditionTag?: string;
  iconName: string;
};

const ALL_DEFS = achievementDefs as AchDef[];

// ─── Main checker ───────────────────────────────────────────────────────────

export type AppState = {
  titanScore: number;
  engineScores: Record<string, number>;
  protocolStreak: number;
  protocolCompleteToday: boolean;
  protocolCompletionHour?: number;
  dayNumber: number;
};

/**
 * Check all achievements against current state.
 * Returns array of newly unlocked achievement IDs.
 */
export function checkAllAchievements(appState: AppState): string[] {
  const unlockedIds = useAchievementStore.getState().unlockedIds;
  const newlyUnlocked: string[] = [];

  const defs: AchievementDef[] = ALL_DEFS.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    rarity: d.rarity as AchievementDef["rarity"],
    xpReward: d.xpReward,
    iconName: d.iconName,
  }));

  for (const def of ALL_DEFS) {
    if (unlockedIds.includes(def.id)) continue;

    const met = evaluateCondition(def, appState);
    if (met) {
      const achDef: AchievementDef = {
        id: def.id,
        name: def.name,
        description: def.description,
        rarity: def.rarity as AchievementDef["rarity"],
        xpReward: def.xpReward,
        iconName: def.iconName,
      };
      useAchievementStore.getState().unlockAchievement(def.id, achDef);
      newlyUnlocked.push(def.id);
    }
  }

  return newlyUnlocked;
}

// ─── Condition evaluator ────────────────────────────────────────────────────

function evaluateCondition(def: AchDef, state: AppState): boolean {
  const val = typeof def.conditionValue === "number" ? def.conditionValue : 0;
  const strVal = typeof def.conditionValue === "string" ? def.conditionValue : "";

  switch (def.conditionType) {
    case "tasks_completed_total":
      return checkTasksCompleted(val);

    case "protocol_completed":
      return checkProtocolCompleted(val);

    case "protocol_time_before":
      return state.protocolCompleteToday && (state.protocolCompletionHour ?? 12) < val;

    case "protocol_time_after":
      return state.protocolCompleteToday && (state.protocolCompletionHour ?? 12) >= val;

    case "all_engines_scored_consecutive":
      return checkAllEnginesConsecutive(val);

    case "votes_total":
      return useIdentityStore.getState().totalVotes >= val;

    case "phase_completed": {
      const phase = useProgressionStore.getState().currentPhase;
      // "building" means Foundation is complete
      const phaseOrder = ["foundation", "building", "intensify", "sustain"];
      const currentIdx = phaseOrder.indexOf(phase);
      const requiredIdx = phaseOrder.indexOf(strVal);
      return currentIdx >= requiredIdx;
    }

    case "quests_completed_total":
      return checkQuestsCompleted(val);

    case "mind_exercises_total":
      return useMindTrainingStore.getState().stats.totalCompleted >= val;

    case "mind_exercises_type": {
      const tag = def.conditionTag ?? "";
      const history = useMindTrainingStore.getState().exerciseHistory;
      return history.filter((r) => r.type === tag).length >= val;
    }

    case "habit_chain_days":
      return checkHabitChain(val);

    case "all_habits_consecutive":
      return checkAllHabitsConsecutive(val);

    case "all_engines_within_range":
      return checkEnginesWithinRange(state.engineScores, val);

    case "streak_days":
      return state.protocolStreak >= val;

    case "streak_with_avg":
      return checkStreakWithAvg(val, def.conditionThreshold ?? 80);

    case "mind_accuracy_over_n": {
      const tag = def.conditionTag ?? "";
      const history = useMindTrainingStore.getState().exerciseHistory;
      const filtered = history.filter((r) => tag === "" || r.type === tag);
      if (filtered.length < val) return false;
      const correct = filtered.filter((r) => r.correct).length;
      return Math.round((correct / filtered.length) * 100) >= (def.conditionThreshold ?? 80);
    }

    case "mind_accuracy_consecutive": {
      const tag = def.conditionTag ?? "";
      const history = useMindTrainingStore.getState().exerciseHistory;
      const filtered = history.filter((r) => tag === "" || r.type === tag);
      let consecutive = 0;
      for (let i = filtered.length - 1; i >= 0; i--) {
        if (filtered[i].correct) consecutive++;
        else break;
      }
      return consecutive >= val;
    }

    case "rank_achieved":
      if (strVal === "SS") return state.titanScore >= 95;
      if (strVal === "S") return state.titanScore >= 85;
      return false;

    case "all_engines_perfect":
      return Object.values(state.engineScores).length >= 4 &&
        Object.values(state.engineScores).every((s) => s >= val);

    case "engine_score_days":
      return checkEngineScoreDays(def.conditionEngine ?? "", val, def.conditionThreshold ?? 50);

    case "journal_entries_total":
      return checkJournalEntries(val);

    case "skill_branch_complete":
      return checkSkillBranchComplete();

    case "titan_mode_unlocked":
      return useTitanModeStore.getState().unlocked;

    case "boss_completed":
      return checkBossCompleted(strVal);

    case "app_days_total":
      return state.dayNumber >= val;

    default:
      return false;
  }
}

// ─── Individual checkers ────────────────────────────────────────────────────

function checkTasksCompleted(target: number): boolean {
  // Check if protocol was completed today (for "first task" achievements)
  // or if streak indicates sustained task completion
  const store = useProtocolStore.getState();
  if (target === 1) return store.todayCompleted || store.streakCurrent >= 1;
  return store.streakCurrent >= target;
}

function checkProtocolCompleted(target: number): boolean {
  const store = useProtocolStore.getState();
  if (target === 1) return store.todayCompleted;
  return store.streakCurrent >= target;
}

function checkAllEnginesConsecutive(days: number): boolean {
  const today = getTodayKey();
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const engines = ["body", "mind", "money", "charisma"];
    const allScored = engines.every((e) => {
      const ids = getJSON<number[]>(`completions:${e}:${dk}`, []);
      return ids.length > 0;
    });
    if (!allScored) return false;
  }
  return true;
}

function checkQuestsCompleted(target: number): boolean {
  // Check completed quests across recent weeks
  const today = getTodayKey();
  let total = 0;
  for (let w = 0; w < 12; w++) {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - w * 7);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    const wk = `weekly_quests:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const quests = getJSON<{ status: string }[]>(wk, []);
    total += quests.filter((q) => q.status === "completed").length;
  }
  return total >= target;
}

function checkHabitChain(days: number): boolean {
  const habits = useHabitStore.getState().habits;
  if (habits.length === 0) return false;
  // Check if any habit has a chain >= days
  for (const h of habits) {
    const stats = useHabitStore.getState().getHabitStats(h.id!, days + 5);
    if (stats.currentChain >= days) return true;
  }
  return false;
}

function checkAllHabitsConsecutive(days: number): boolean {
  const habits = useHabitStore.getState().habits;
  if (habits.length === 0) return false;
  const today = getTodayKey();
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
    const allDone = habits.every((h) => logs.includes(h.id!));
    if (!allDone) return false;
  }
  return true;
}

function checkEnginesWithinRange(scores: Record<string, number>, range: number): boolean {
  const vals = Object.values(scores);
  if (vals.length < 4) return false;
  const activeVals = vals.filter((v) => v > 0);
  if (activeVals.length < 4) return false;
  const max = Math.max(...activeVals);
  const min = Math.min(...activeVals);
  return (max - min) <= range;
}

function checkStreakWithAvg(days: number, threshold: number): boolean {
  const streak = useProtocolStore.getState().streakCurrent;
  if (streak < days) return false;
  // Check average over the streak period
  const today = getTodayKey();
  let total = 0;
  let count = 0;
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const comp = getJSON<{ completed: boolean; score: number } | null>(`protocol_completions:${dk}`, null);
    if (comp && comp.completed) {
      total += comp.score;
      count++;
    }
  }
  if (count < days) return false;
  return Math.round(total / count) >= threshold;
}

function checkEngineScoreDays(engine: string, days: number, threshold: number): boolean {
  const today = getTodayKey();
  let count = 0;
  for (let i = 0; i < 14; i++) {
    const dk = addDays(today, -i);
    const ids = getJSON<number[]>(`completions:${engine}:${dk}`, []);
    if (ids.length > 0) count++; // Simplified: any activity counts
    if (count >= days) return true;
  }
  return false;
}

function checkJournalEntries(target: number): boolean {
  const today = getTodayKey();
  let count = 0;
  for (let i = 0; i < 90; i++) {
    const dk = addDays(today, -i);
    const entry = getJSON<{ content: string } | null>(`journal:${dk}`, null);
    if (entry && entry.content) count++;
    if (count >= target) return true;
  }
  return false;
}

function checkSkillBranchComplete(): boolean {
  const progress = useSkillTreeStore.getState().progress;
  for (const engine of ["body", "mind", "money", "charisma"]) {
    const nodes = progress[engine] ?? [];
    const branchMap = new Map<string, { total: number; completed: number }>();
    for (const n of nodes) {
      if (!branchMap.has(n.branch)) branchMap.set(n.branch, { total: 0, completed: 0 });
      const b = branchMap.get(n.branch)!;
      b.total++;
      if (n.status === "claimed") b.completed++;
    }
    for (const b of branchMap.values()) {
      if (b.total > 0 && b.completed === b.total) return true;
    }
  }
  return false;
}

function checkBossCompleted(bossId: string): boolean {
  const completedIds = getJSON<string[]>("completed_boss_ids", []);
  return completedIds.includes(bossId);
}
