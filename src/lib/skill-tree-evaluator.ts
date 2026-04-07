/**
 * Skill tree progress evaluation
 *
 * Reads from existing stores to check if skill nodes should be unlocked.
 * Called from protocol-completion after each protocol session.
 */

import { useProtocolStore } from "../stores/useProtocolStore";
import { useMindTrainingStore } from "../stores/useMindTrainingStore";
import { useSkillTreeStore } from "../stores/useSkillTreeStore";
import { getJSON, storage } from "../db/storage";
import { getTodayKey, addDays } from "./date";
import skillTreeData from "../data/skill-trees.json";
// Phase 3.5f: cloud cache read for checkHabitStreak. The legacy
// useProtocolStore.streakCurrent becomes stale after Phase 3.5b
// because the protocol screen writes streak to profiles.streak_current
// (cloud). We read the cloud value via the shared queryClient
// singleton and fall back to the legacy store if the cache isn't
// primed yet.
import { queryClient } from "./query-client";
import { profileQueryKey } from "../hooks/queries/useProfile";
import type { Profile } from "../services/profile";

// ─── Types ──────────────────────────────────────────────────────────────────

type LevelDef = {
  nodeId: string;
  level: number;
  name: string;
  description: string;
  requirementType: string;
  requirementEngine: string;
  requirementTag?: string;
  targetValue: number;
  threshold?: number;
};

type BranchDef = {
  id: string;
  name: string;
  levels: LevelDef[];
};

type EngineDef = {
  branches: BranchDef[];
};

const TREE_DATA = skillTreeData as Record<string, EngineDef>;

// ─── Evaluator ──────────────────────────────────────────────────────────────

/**
 * Evaluate all skill tree nodes for an engine.
 * Returns list of nodes that are newly eligible for unlock.
 */
export function evaluateSkillTree(engine: string): { nodeId: string; name: string; branch: string; level: number }[] {
  const engineData = TREE_DATA[engine];
  if (!engineData) return [];

  const store = useSkillTreeStore.getState();
  const progress = store.progress[engine] ?? [];
  const newlyEligible: { nodeId: string; name: string; branch: string; level: number }[] = [];

  for (const branch of engineData.branches) {
    for (const levelDef of branch.levels) {
      // Find current node progress
      const nodeProgress = progress.find((n) => n.nodeId === levelDef.nodeId);

      // Skip already claimed or ready nodes
      if (nodeProgress && (nodeProgress.status === "claimed" || nodeProgress.status === "ready")) continue;

      // Check prerequisite: previous level must be claimed
      if (levelDef.level > 1) {
        const prevNode = progress.find(
          (n) => n.branch === branch.id && n.level === levelDef.level - 1,
        );
        if (!prevNode || prevNode.status !== "claimed") continue;
      }

      // Check if requirement is met
      const met = checkRequirement(levelDef);
      if (met) {
        newlyEligible.push({
          nodeId: levelDef.nodeId,
          name: levelDef.name,
          branch: branch.name,
          level: levelDef.level,
        });
      }
    }
  }

  return newlyEligible;
}

/**
 * Initialize skill tree nodes for an engine from JSON definitions.
 */
export function initializeEngineTree(engine: string): void {
  const engineData = TREE_DATA[engine];
  if (!engineData) return;

  const nodes = engineData.branches.flatMap((branch) =>
    branch.levels.map((level) => ({
      nodeId: level.nodeId,
      engine,
      branch: branch.id,
      level: level.level,
      name: level.name,
    })),
  );

  useSkillTreeStore.getState().initializeTree(engine, nodes);
}

/**
 * Initialize all 4 engine skill trees.
 */
export function initializeAllTrees(): void {
  for (const engine of ["body", "mind", "money", "charisma"]) {
    initializeEngineTree(engine);
  }
}

/**
 * Run evaluation across all engines. Returns all newly unlocked nodes.
 * Auto-initializes trees if they haven't been initialized yet.
 */
export function evaluateAllTrees(): { nodeId: string; name: string; branch: string; level: number; engine: string }[] {
  const results: { nodeId: string; name: string; branch: string; level: number; engine: string }[] = [];

  for (const engine of ["body", "mind", "money", "charisma"]) {
    // Auto-initialize tree if progress is empty for this engine
    const progress = useSkillTreeStore.getState().progress[engine];
    if (!progress || progress.length === 0) {
      initializeEngineTree(engine);
    }

    const eligible = evaluateSkillTree(engine);
    for (const node of eligible) {
      // Unlock the node (sets to "ready" — user must claim it)
      useSkillTreeStore.getState().unlockNode(engine, node.nodeId);
      results.push({ ...node, engine });
    }
  }

  return results;
}

// ─── Requirement Checkers ───────────────────────────────────────────────────

function checkRequirement(def: LevelDef): boolean {
  switch (def.requirementType) {
    case "streak_days":
      return checkStreakDays(def.targetValue);

    case "engine_avg_weeks":
      return checkEngineAvgWeeks(def.requirementEngine, def.targetValue, def.threshold ?? 70);

    case "exercise_count":
      return checkExerciseCount(def.requirementTag ?? "", def.targetValue);

    case "exercise_accuracy":
      return checkExerciseAccuracy(def.requirementTag ?? "", def.targetValue, def.threshold ?? 80);

    case "exercise_categories":
      return checkExerciseCategories(def.requirementTag ?? "", def.targetValue);

    case "exercise_all_categories":
      return checkAllCategories(def.requirementTag ?? "");

    case "focus_sessions":
      return checkFocusSessions(def.targetValue);

    case "task_count":
      return checkTaskCount(def.requirementEngine, def.targetValue);

    case "boss_complete":
      return checkBossComplete(def.requirementEngine);

    case "log_count":
      return checkLogCount(def.requirementTag ?? "", def.targetValue);

    case "habit_streak":
      return checkHabitStreak(def.targetValue);

    case "habit_completion_rate":
      return checkHabitCompletionRate(def.targetValue, def.threshold ?? 80);

    case "weekly_consistency":
      return checkWeeklyConsistency(def.targetValue);

    case "branch_level_check":
      return checkBranchLevelCheck(def.requirementEngine, def.targetValue);

    case "srs_recall_accuracy":
      return checkSRSRecallAccuracy(def.targetValue, def.threshold ?? 80);

    case "focus_daily_avg":
      return checkFocusDailyAvg(def.targetValue, def.threshold ?? 2);

    case "focus_marathon":
      return checkFocusMarathon(def.targetValue, def.threshold ?? 240);

    case "sleep_avg_weeks":
      return checkSleepAvgWeeks(def.targetValue, def.threshold ?? 7);

    default:
      return false;
  }
}

// ─── Individual Checkers ────────────────────────────────────────────────────

function checkStreakDays(target: number): boolean {
  // Count consecutive days (ending today) with ANY task completion across all engines
  const today = getTodayKey();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dk = addDays(today, -i);
    let dayHasCompletion = false;
    const allKeys = storage.getAllKeys() as string[];
    for (const key of allKeys) {
      if (key.startsWith("completions:") && key.endsWith(`:${dk}`)) {
        const ids = getJSON<number[]>(key, []);
        if (ids.length > 0) {
          dayHasCompletion = true;
          break;
        }
      }
    }
    if (dayHasCompletion) {
      streak++;
    } else {
      break; // streak broken
    }
  }
  return streak >= target;
}

function checkEngineAvgWeeks(engine: string, weeks: number, threshold: number): boolean {
  const today = getTodayKey();
  const totalDays = weeks * 7;
  let scoreDays = 0;
  for (let i = 0; i < totalDays; i++) {
    const dk = addDays(today, -i);
    const ids = getJSON<number[]>(`completions:${engine}:${dk}`, []);
    if (ids.length > 0) {
      scoreDays++;
    }
  }
  if (scoreDays === 0) return false;
  const avgActivityRate = Math.round((scoreDays / totalDays) * 100);
  return avgActivityRate >= threshold;
}

function checkExerciseCount(tag: string, target: number): boolean {
  const history = useMindTrainingStore.getState().exerciseHistory;
  const count = history.filter((r) => r.type === tag || tag === "").length;
  return count >= target;
}

function checkExerciseAccuracy(tag: string, minCount: number, threshold: number): boolean {
  const history = useMindTrainingStore.getState().exerciseHistory;
  const filtered = history.filter((r) => r.type === tag || tag === "");
  if (filtered.length < minCount) return false;
  const correct = filtered.filter((r) => r.correct).length;
  const accuracy = Math.round((correct / filtered.length) * 100);
  return accuracy >= threshold;
}

function checkExerciseCategories(tag: string, targetCategories: number): boolean {
  const history = useMindTrainingStore.getState().exerciseHistory;
  const filtered = history.filter((r) => r.type === tag && r.correct);
  const categories = new Set(filtered.map((r) => r.category));
  return categories.size >= targetCategories;
}

function checkAllCategories(tag: string): boolean {
  // Check if user completed at least one correct exercise in each available category for this type
  const history = useMindTrainingStore.getState().exerciseHistory;
  const filtered = history.filter((r) => r.type === tag && r.correct);
  const completedCategories = new Set(filtered.map((r) => r.category));
  // Need at least 5 different categories to consider "all" (rough heuristic)
  return completedCategories.size >= 5;
}

function checkFocusSessions(target: number): boolean {
  // Fallback: count mind engine completions as proxy for focus sessions
  const allKeys = storage.getAllKeys() as string[];
  let count = 0;
  for (const key of allKeys) {
    if (key.startsWith("completions:mind:")) {
      const ids = getJSON<number[]>(key, []);
      count += ids.length;
    }
  }
  return count >= target;
}

function checkTaskCount(engine: string, target: number): boolean {
  // Count total completed tasks for this engine across all dates
  const allKeys = storage.getAllKeys() as string[];
  let count = 0;
  const prefix = `completions:${engine}:`;
  for (const key of allKeys) {
    if (key.startsWith(prefix)) {
      const ids = getJSON<number[]>(key, []);
      count += ids.length;
    }
  }
  return count >= target;
}

function checkBossComplete(engine: string): boolean {
  const completedIds = getJSON<string[]>("completed_boss_ids", []);
  // Any boss completion counts — engine-specific boss mapping would require
  // cross-referencing boss definitions, so for MVP any boss unlocks the node
  return completedIds.length > 0;
}

function checkLogCount(tag: string, target: number): boolean {
  // Count total completions across all engines as a general activity proxy
  const allKeys = storage.getAllKeys() as string[];
  let count = 0;
  for (const key of allKeys) {
    if (key.startsWith("completions:")) {
      const ids = getJSON<number[]>(key, []);
      count += ids.length;
    }
  }
  return count >= target;
}

function checkHabitStreak(target: number): boolean {
  // Post-Phase 3.5b, streak lives on the cloud profile. Read from
  // the React Query cache first; fall back to the legacy store for
  // the pre-migration case where the cache hasn't hydrated yet.
  const cloudProfile = queryClient.getQueryData<Profile | null>(profileQueryKey);
  const streak =
    cloudProfile?.streak_current ?? useProtocolStore.getState().streakCurrent;
  return streak >= target;
}

function checkHabitCompletionRate(days: number, threshold: number): boolean {
  const today = getTodayKey();
  let activeDays = 0;
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const logs = getJSON<number[]>(`habit_logs:${dk}`, []);
    if (logs.length > 0) activeDays++;
  }
  const rate = days > 0 ? Math.round((activeDays / days) * 100) : 0;
  return rate >= threshold;
}

function checkWeeklyConsistency(targetWeeks: number): boolean {
  const today = getTodayKey();
  let weeksWithActivity = 0;
  for (let w = 0; w < targetWeeks + 2; w++) {
    let weekActive = false;
    for (let d = 0; d < 7; d++) {
      const dk = addDays(today, -(w * 7 + d));
      const allKeys = storage.getAllKeys() as string[];
      for (const key of allKeys) {
        if (key.startsWith(`completions:`) && key.endsWith(`:${dk}`)) {
          const ids = getJSON<number[]>(key, []);
          if (ids.length > 0) { weekActive = true; break; }
        }
      }
      if (weekActive) break;
    }
    if (weekActive) weeksWithActivity++;
  }
  return weeksWithActivity >= targetWeeks;
}

function checkBranchLevelCheck(engine: string, minLevel: number): boolean {
  const progress = useSkillTreeStore.getState().progress[engine] ?? [];
  const engineData = TREE_DATA[engine];
  if (!engineData) return false;

  // Check that ALL branches have at least one node at minLevel completed
  for (const branch of engineData.branches) {
    const branchNodes = progress.filter((n) => n.branch === branch.id);
    const hasLevel = branchNodes.some((n) => n.level >= minLevel && n.status === "claimed");
    if (!hasLevel) return false;
  }
  return true;
}

function checkFocusDailyAvg(days: number, minSessions: number): boolean {
  // Fallback: count mind engine completions per day as proxy for focus sessions
  const today = getTodayKey();
  let totalSessions = 0;
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const ids = getJSON<number[]>(`completions:mind:${dk}`, []);
    totalSessions += ids.length;
  }
  const avg = days > 0 ? totalSessions / days : 0;
  return avg >= minSessions;
}

function checkFocusMarathon(targetDays: number, minMinutes: number): boolean {
  // Fallback: count days with mind engine completions as proxy for focus marathon
  const today = getTodayKey();
  let marathonDays = 0;
  for (let i = 0; i < 90; i++) {
    const dk = addDays(today, -i);
    const ids = getJSON<number[]>(`completions:mind:${dk}`, []);
    if (ids.length > 0) marathonDays++;
  }
  return marathonDays >= targetDays;
}

function checkSleepAvgWeeks(weeks: number, minHours: number): boolean {
  // Fallback: count body engine completions as proxy for sleep/recovery tracking
  const today = getTodayKey();
  const days = weeks * 7;
  let activeDays = 0;
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const ids = getJSON<number[]>(`completions:body:${dk}`, []);
    if (ids.length > 0) activeDays++;
  }
  // Consider it met if at least 50% of days had body activity
  const rate = days > 0 ? Math.round((activeDays / days) * 100) : 0;
  return rate >= (minHours > 0 ? 50 : 30);
}

function checkSRSRecallAccuracy(minDaysOld: number, threshold: number): boolean {
  const cards = useMindTrainingStore.getState().srsCards;
  // Check if there are cards with intervals >= minDaysOld and good accuracy
  const oldCards = cards.filter((c) => c.interval >= minDaysOld);
  if (oldCards.length < 5) return false; // Need at least 5 mature cards

  const history = useMindTrainingStore.getState().exerciseHistory;
  let correct = 0;
  let total = 0;
  for (const card of oldCards) {
    const results = history.filter((r) => r.exerciseId === card.exerciseId);
    for (const r of results) {
      total++;
      if (r.correct) correct++;
    }
  }
  if (total === 0) return false;
  return Math.round((correct / total) * 100) >= threshold;
}
