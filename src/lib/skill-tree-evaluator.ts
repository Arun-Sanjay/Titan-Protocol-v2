/**
 * Skill tree progress evaluation
 *
 * Reads from existing stores to check if skill nodes should be unlocked.
 * Called from protocol-completion after each protocol session.
 */

import { getJSON, storage } from "../db/storage";
import { getTodayKey, addDays } from "./date";
import skillTreeData from "../data/skill-trees.json";
import { queryClient } from "./query-client";
import { profileQueryKey } from "../hooks/queries/useProfile";
import { skillTreeKeys } from "../hooks/queries/useSkillTree";
import { setSkillNodeReady, type SkillProgress } from "../services/skill-tree";
import type { Profile } from "../services/profile";
import { cachedStreakCurrent, cachedMindTrainingResults } from "./cached-cloud";
import { logError } from "./error-log";
import type { Enums } from "../types/supabase";

type CloudSkillRow = SkillProgress;

function cachedSkillProgressForEngine(engine: string): CloudSkillRow[] {
  const rows = queryClient.getQueryData<CloudSkillRow[]>(skillTreeKeys.all) ?? [];
  return rows.filter((r) => r.engine === engine);
}

function cachedSkillStatus(engine: string, nodeId: string): "locked" | "ready" | "claimed" {
  const rows = cachedSkillProgressForEngine(engine);
  const found = rows.find((r) => r.node_id === nodeId);
  return (found?.state as "locked" | "ready" | "claimed" | undefined) ?? "locked";
}

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

  const rows = cachedSkillProgressForEngine(engine);
  const rowByNodeId = new Map(rows.map((r) => [r.node_id, r]));
  const newlyEligible: { nodeId: string; name: string; branch: string; level: number }[] = [];

  for (const branch of engineData.branches) {
    for (const levelDef of branch.levels) {
      const row = rowByNodeId.get(levelDef.nodeId);

      // Skip already claimed or ready nodes
      if (row && (row.state === "claimed" || row.state === "ready")) continue;

      // Check prerequisite: previous level must be claimed
      if (levelDef.level > 1) {
        const prevLevel = branch.levels.find((l) => l.level === levelDef.level - 1);
        if (!prevLevel) continue;
        const prevRow = rowByNodeId.get(prevLevel.nodeId);
        if (!prevRow || prevRow.state !== "claimed") continue;
      }

      if (checkRequirement(levelDef)) {
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
 * No-op under Supabase-first. Tree structure is static (skill-trees.json)
 * and progress is derived from skill_tree_progress rows + defs. Kept as
 * exports so legacy callers don't break.
 */
export function initializeEngineTree(_engine: string): void {
  // Nothing to do — cloud is the source of truth.
}

export function initializeAllTrees(): void {
  // Nothing to do.
}

/**
 * Run evaluation across all engines. For each newly eligible node,
 * write state='ready' to Supabase so the UI shows the claim button.
 * Invalidates the skill tree query cache when any writes happen.
 */
export function evaluateAllTrees(): { nodeId: string; name: string; branch: string; level: number; engine: string }[] {
  const results: { nodeId: string; name: string; branch: string; level: number; engine: string }[] = [];
  let anyWritten = false;

  for (const engine of ["body", "mind", "money", "charisma"]) {
    const eligible = evaluateSkillTree(engine);
    for (const node of eligible) {
      setSkillNodeReady({
        node_id: node.nodeId,
        engine: engine as Enums<"engine_key">,
      })
        .then(() => {
          anyWritten = true;
        })
        .catch((e) => logError("evaluateAllTrees.setReady", e, { engine, node: node.nodeId }));
      results.push({ ...node, engine });
    }
  }

  if (results.length > 0) {
    // Fire-and-forget invalidation — the awaits above are staggered promises
    queryClient.invalidateQueries({ queryKey: skillTreeKeys.all });
  }
  void anyWritten;

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

/**
 * Phase 1.6: Pre-compute the set of date keys that have at least one
 * completion. The previous code called `storage.getAllKeys()` once per
 * day in a 365-iteration loop AND once per day in the nested
 * (week × day) loop in checkWeeklyConsistency, which stalled the JS
 * thread on year-old users with thousands of MMKV keys.
 *
 * This helper does a single pass over `getAllKeys()` and returns a
 * `Set<dateKey>` for fast O(1) day lookups.
 */
function buildCompletedDatesIndex(prefix: string = "completions:"): Set<string> {
  const allKeys = storage.getAllKeys() as string[];
  const completedDates = new Set<string>();
  for (const key of allKeys) {
    if (!key.startsWith(prefix)) continue;
    // Format: "completions:{engine}:{YYYY-MM-DD}"
    const parts = key.split(":");
    if (parts.length !== 3) continue;
    const dateKey = parts[2];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    // Skip the per-key getJSON read for the streak path — empty arrays
    // are vanishingly rare for completion keys (writers don't create
    // them) and the cost of checking each one is exactly the perf bug
    // we're fixing.
    const ids = getJSON<number[]>(key, []);
    if (ids.length > 0) completedDates.add(dateKey);
  }
  return completedDates;
}

function checkStreakDays(target: number): boolean {
  // Count consecutive days (ending today) with ANY task completion across all engines
  const today = getTodayKey();
  const completedDates = buildCompletedDatesIndex();
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const dk = addDays(today, -i);
    if (completedDates.has(dk)) {
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
  const history = cachedMindTrainingResults();
  const count = history.filter((r) => r.type === tag || tag === "").length;
  return count >= target;
}

function checkExerciseAccuracy(tag: string, minCount: number, threshold: number): boolean {
  const history = cachedMindTrainingResults();
  const filtered = history.filter((r) => r.type === tag || tag === "");
  if (filtered.length < minCount) return false;
  const correct = filtered.filter((r) => r.correct).length;
  const accuracy = Math.round((correct / filtered.length) * 100);
  return accuracy >= threshold;
}

function checkExerciseCategories(tag: string, targetCategories: number): boolean {
  const history = cachedMindTrainingResults();
  const filtered = history.filter((r) => r.type === tag && r.correct);
  const categories = new Set(filtered.map((r) => r.category));
  return categories.size >= targetCategories;
}

function checkAllCategories(tag: string): boolean {
  const history = cachedMindTrainingResults();
  const filtered = history.filter((r) => r.type === tag && r.correct);
  const completedCategories = new Set(filtered.map((r) => r.category));
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
    cloudProfile?.streak_current ?? cachedStreakCurrent();
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
  // Phase 1.6: hoist getAllKeys() out of the nested (week × day) loop.
  const today = getTodayKey();
  const completedDates = buildCompletedDatesIndex();
  let weeksWithActivity = 0;
  for (let w = 0; w < targetWeeks + 2; w++) {
    let weekActive = false;
    for (let d = 0; d < 7; d++) {
      const dk = addDays(today, -(w * 7 + d));
      if (completedDates.has(dk)) {
        weekActive = true;
        break;
      }
    }
    if (weekActive) weeksWithActivity++;
  }
  return weeksWithActivity >= targetWeeks;
}

function checkBranchLevelCheck(engine: string, minLevel: number): boolean {
  const rows = cachedSkillProgressForEngine(engine);
  const engineData = TREE_DATA[engine];
  if (!engineData) return false;

  const nodeMeta = new Map<string, { branchId: string; level: number }>();
  for (const branch of engineData.branches) {
    for (const lv of branch.levels) {
      nodeMeta.set(lv.nodeId, { branchId: branch.id, level: lv.level });
    }
  }

  for (const branch of engineData.branches) {
    const hasLevel = rows.some((r) => {
      if (r.state !== "claimed") return false;
      const meta = nodeMeta.get(r.node_id);
      return Boolean(meta && meta.branchId === branch.id && meta.level >= minLevel);
    });
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

function checkSRSRecallAccuracy(_minDaysOld: number, _threshold: number): boolean {
  // SRS card state lives in the srs_cards Supabase table but isn't
  // currently read by any React Query hook. Until we wire that up,
  // this recall-accuracy check is effectively disabled — previously
  // it read from a local mind-training store that held both history
  // and cards in MMKV.
  return false;
}
