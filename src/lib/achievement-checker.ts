/**
 * Achievement condition evaluation
 *
 * Checks all achievement conditions against current app state.
 * Returns list of newly unlocked achievement IDs.
 */

import { cachedStreakCurrent, cachedTodayCompleted, cachedMindTrainingResults } from "./cached-cloud";
import { useIdentityStore } from "../stores/useIdentityStore";
import { skillTreeKeys } from "../hooks/queries/useSkillTree";
import type { SkillProgress } from "../services/skill-tree";
import skillTreeData from "../data/skill-trees.json";
import { cachedTitanModeUnlocked } from "./cached-cloud";
import { cachedCurrentPhase } from "./cached-cloud";
import { useAchievementStore, type AchievementDef } from "../stores/useAchievementStore";
import { queryClient } from "./query-client";
import { habitsKeys } from "../hooks/queries/useHabits";
import type { Habit } from "../services/habits";
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
  /**
   * Lifetime count of non-deleted rows in `completions`. Used by
   * `tasks_completed_total`-type conditions (e.g. First Blood). Must be
   * read from SQLite at `gatherAppState` time — we can't derive it from
   * the protocol streak (different concept entirely: protocol = daily
   * ritual, completions = per-task taps).
   */
  totalCompletionsCount: number;
};

export type PendingUnlock = { id: string; def: AchievementDef };

/**
 * Evaluate every achievement condition against `appState` and return the
 * defs for any that newly qualify. **Pure** — does NOT push to the UI
 * queue and does NOT write to SQLite. The caller (`runAchievementCheck`)
 * is responsible for persisting the unlock first and THEN pushing to the
 * celebration queue, so a failed write can't leave a ghost toast behind.
 *
 * `alreadyUnlocked` is the authoritative set of IDs the user already
 * holds — reads from SQLite so the check has the real truth, not
 * whatever happens to be in the React Query cache at the moment.
 *
 * Multiple passes so meta-achievements (those that depend on another
 * achievement being unlocked) fire in the same call. Bounded loop
 * count prevents infinite cycles.
 */
export function checkAllAchievements(
  appState: AppState,
  alreadyUnlocked: Set<string>,
): PendingUnlock[] {
  const liveUnlocked = new Set(alreadyUnlocked);
  const pending: PendingUnlock[] = [];

  let changed = true;
  let safety = 8;
  while (changed && safety-- > 0) {
    changed = false;
    for (const def of ALL_DEFS) {
      if (liveUnlocked.has(def.id)) continue;
      if (!evaluateCondition(def, appState, liveUnlocked)) continue;

      const achDef: AchievementDef = {
        id: def.id,
        name: def.name,
        description: def.description,
        rarity: def.rarity as AchievementDef["rarity"],
        xpReward: def.xpReward,
        iconName: def.iconName,
      };
      liveUnlocked.add(def.id);
      pending.push({ id: def.id, def: achDef });
      changed = true;
    }
  }

  return pending;
}

// ─── Condition evaluator ────────────────────────────────────────────────────
//
// Phase 1.5: takes a `liveUnlocked` Set so meta-achievements (e.g.
// "first 5 achievements unlocked") can see in-flight unlocks from the
// same `checkAllAchievements` call.

function evaluateCondition(
  def: AchDef,
  state: AppState,
  liveUnlocked: Set<string>,
): boolean {
  const val = typeof def.conditionValue === "number" ? def.conditionValue : 0;
  const strVal = typeof def.conditionValue === "string" ? def.conditionValue : "";

  // Allow conditions to query the live unlock set for meta-achievements.
  // Currently no condition type uses this, but the parameter is in place
  // for future "first N unlocks" / "unlock chain" achievements.
  void liveUnlocked;

  switch (def.conditionType) {
    case "tasks_completed_total":
      return checkTasksCompleted(state, val);

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
      const phase = cachedCurrentPhase();
      const phaseOrder = ["foundation", "building", "intensify", "sustain"];
      const currentIdx = phaseOrder.indexOf(phase);
      const requiredIdx = phaseOrder.indexOf(strVal);
      return currentIdx >= requiredIdx;
    }

    case "quests_completed_total":
      return checkQuestsCompleted(val);

    case "mind_exercises_total":
      return cachedMindTrainingResults().length >= val;

    case "mind_exercises_type": {
      const tag = def.conditionTag ?? "";
      return cachedMindTrainingResults().filter((r) => r.type === tag).length >= val;
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
      const filtered = cachedMindTrainingResults().filter((r) => tag === "" || r.type === tag);
      if (filtered.length < val) return false;
      const correct = filtered.filter((r) => r.correct).length;
      return Math.round((correct / filtered.length) * 100) >= (def.conditionThreshold ?? 80);
    }

    case "mind_accuracy_consecutive": {
      const tag = def.conditionTag ?? "";
      const filtered = cachedMindTrainingResults().filter((r) => tag === "" || r.type === tag);
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
      return cachedTitanModeUnlocked();

    case "boss_completed":
      return checkBossCompleted(strVal);

    case "app_days_total":
      return state.dayNumber >= val;

    default:
      return false;
  }
}

// ─── Individual checkers ────────────────────────────────────────────────────

function checkTasksCompleted(state: AppState, target: number): boolean {
  // `tasks_completed_total` means "lifetime count of completion rows" —
  // First Blood = 1, and larger thresholds ladder up from there. Reading
  // from SQLite is the only truthful source; the protocol streak is a
  // different concept (days a protocol was done) and was the source of
  // the duplicate-toast-every-launch bug.
  return state.totalCompletionsCount >= target;
}

function checkProtocolCompleted(target: number): boolean {
  const today = getTodayKey();
  if (target === 1) return cachedTodayCompleted(today);
  return cachedStreakCurrent() >= target;
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

function cachedHabits(): Habit[] {
  return queryClient.getQueryData<Habit[]>(habitsKeys.all) ?? [];
}

function checkHabitChain(days: number): boolean {
  const habits = cachedHabits();
  if (habits.length === 0) return false;
  for (const h of habits) {
    if ((h.current_chain ?? 0) >= days) return true;
  }
  return false;
}

function checkAllHabitsConsecutive(days: number): boolean {
  const habits = cachedHabits();
  if (habits.length === 0) return false;
  // Every habit must have a current_chain of at least `days`.
  return habits.every((h) => (h.current_chain ?? 0) >= days);
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
  const streak = cachedStreakCurrent();
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
  const rows = queryClient.getQueryData<SkillProgress[]>(skillTreeKeys.all) ?? [];
  const trees = skillTreeData as Record<string, { branches: { id: string; levels: { nodeId: string }[] }[] }>;
  for (const engine of ["body", "mind", "money", "charisma"]) {
    const engineDef = trees[engine];
    if (!engineDef) continue;
    const claimedIds = new Set(
      rows.filter((r) => r.engine === engine && r.state === "claimed").map((r) => r.node_id),
    );
    for (const branch of engineDef.branches) {
      if (branch.levels.length === 0) continue;
      const allClaimed = branch.levels.every((l) => claimedIds.has(l.nodeId));
      if (allClaimed) return true;
    }
  }
  return false;
}

function checkBossCompleted(bossId: string): boolean {
  const completedIds = getJSON<string[]>("completed_boss_ids", []);
  return completedIds.includes(bossId);
}
