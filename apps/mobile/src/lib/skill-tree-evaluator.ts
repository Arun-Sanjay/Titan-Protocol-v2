/**
 * Skill tree progress evaluation
 *
 * Reads from existing stores to check if skill nodes should be unlocked.
 * Called from protocol-completion after each protocol session.
 */

import { useProtocolStore } from "../stores/useProtocolStore";
import { useMindTrainingStore } from "../stores/useMindTrainingStore";
import { useSkillTreeStore } from "../stores/useSkillTreeStore";
import { getJSON } from "../db/storage";
import { getTodayKey, addDays } from "./date";
import skillTreeData from "../data/skill-trees.json";

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

      // Skip already completed nodes
      if (nodeProgress && nodeProgress.status === "completed") continue;

      // Check prerequisite: previous level must be completed
      if (levelDef.level > 1) {
        const prevNode = progress.find(
          (n) => n.branch === branch.id && n.level === levelDef.level - 1,
        );
        if (!prevNode || prevNode.status !== "completed") continue;
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
 */
export function evaluateAllTrees(): { nodeId: string; name: string; branch: string; level: number; engine: string }[] {
  const results: { nodeId: string; name: string; branch: string; level: number; engine: string }[] = [];

  for (const engine of ["body", "mind", "money", "charisma"]) {
    const eligible = evaluateSkillTree(engine);
    for (const node of eligible) {
      // Unlock the node
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
  const streak = useProtocolStore.getState().streakCurrent;
  return streak >= target;
}

function checkEngineAvgWeeks(engine: string, weeks: number, threshold: number): boolean {
  const today = getTodayKey();
  const totalDays = weeks * 7;
  let totalScore = 0;
  let scoreDays = 0;

  for (let i = 0; i < totalDays; i++) {
    const dk = addDays(today, -i);
    // Read engine completion IDs and task list to compute score
    const completionIds = getJSON<number[]>(`completions:${engine}:${dk}`, []);
    if (completionIds.length > 0) {
      // If any completions exist, count it as an active day
      // Approximate engine score from protocol completion
      const protocolComp = getJSON<{ completed: boolean; score: number } | null>(`protocol_completions:${dk}`, null);
      if (protocolComp && protocolComp.completed) {
        totalScore += protocolComp.score;
        scoreDays++;
      }
    }
  }

  if (scoreDays < weeks * 3) return false; // Need at least ~3 active days per week
  const avg = scoreDays > 0 ? Math.round(totalScore / scoreDays) : 0;
  return avg >= threshold;
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
  // Read focus session count from MMKV
  const today = getTodayKey();
  let total = 0;
  for (let i = 0; i < 90; i++) {
    const dk = addDays(today, -i);
    const daily = getJSON<{ sessions: number } | null>(`focus_daily:${dk}`, null);
    if (daily) total += daily.sessions;
  }
  return total >= target;
}

function checkTaskCount(engine: string, target: number): boolean {
  // Simplified: check protocol streak as a proxy for consistent task completion
  const streak = useProtocolStore.getState().streakCurrent;
  return streak >= target;
}

function checkBossComplete(engine: string): boolean {
  const completedIds = getJSON<string[]>("completed_boss_ids", []);
  // Any boss completion counts — engine-specific boss mapping would require
  // cross-referencing boss definitions, so for MVP any boss unlocks the node
  return completedIds.length > 0;
}

function checkLogCount(tag: string, target: number): boolean {
  // Generic log count check — reads from MMKV based on tag
  // Simplified: use protocol completion count as proxy
  const today = getTodayKey();
  let count = 0;
  for (let i = 0; i < 90; i++) {
    const dk = addDays(today, -i);
    const comp = getJSON<{ completed: boolean } | null>(`protocol_completions:${dk}`, null);
    if (comp && comp.completed) count++;
  }
  return count >= target;
}

function checkHabitStreak(target: number): boolean {
  const streak = useProtocolStore.getState().streakCurrent;
  return streak >= target;
}

function checkHabitCompletionRate(days: number, threshold: number): boolean {
  // Simplified: check if protocol streak meets the threshold duration
  const streak = useProtocolStore.getState().streakCurrent;
  return streak >= days;
}

function checkWeeklyConsistency(targetWeeks: number): boolean {
  const streak = useProtocolStore.getState().streakCurrent;
  return streak >= targetWeeks * 5; // ~5 active days per week
}

function checkBranchLevelCheck(engine: string, minLevel: number): boolean {
  const progress = useSkillTreeStore.getState().progress[engine] ?? [];
  const engineData = TREE_DATA[engine];
  if (!engineData) return false;

  // Check that ALL branches have at least one node at minLevel completed
  for (const branch of engineData.branches) {
    const branchNodes = progress.filter((n) => n.branch === branch.id);
    const hasLevel = branchNodes.some((n) => n.level >= minLevel && n.status === "completed");
    if (!hasLevel) return false;
  }
  return true;
}

function checkFocusDailyAvg(days: number, minSessions: number): boolean {
  const today = getTodayKey();
  let totalSessions = 0;
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const daily = getJSON<{ sessions: number } | null>(`focus_daily:${dk}`, null);
    if (daily) totalSessions += daily.sessions;
  }
  const avg = days > 0 ? totalSessions / days : 0;
  return avg >= minSessions;
}

function checkFocusMarathon(targetDays: number, minMinutes: number): boolean {
  const today = getTodayKey();
  let marathonDays = 0;
  for (let i = 0; i < 90; i++) {
    const dk = addDays(today, -i);
    const daily = getJSON<{ totalMinutes?: number; sessions: number } | null>(`focus_daily:${dk}`, null);
    if (daily && (daily.totalMinutes ?? 0) >= minMinutes) {
      marathonDays++;
    }
  }
  return marathonDays >= targetDays;
}

function checkSleepAvgWeeks(weeks: number, minHours: number): boolean {
  const today = getTodayKey();
  const days = weeks * 7;
  let totalHours = 0;
  let loggedDays = 0;
  for (let i = 0; i < days; i++) {
    const dk = addDays(today, -i);
    const sleep = getJSON<{ hours?: number } | null>(`sleep:${dk}`, null);
    if (sleep && sleep.hours) {
      totalHours += sleep.hours;
      loggedDays++;
    }
  }
  if (loggedDays < days * 0.5) return false; // Need at least 50% of days logged
  const avg = loggedDays > 0 ? totalHours / loggedDays : 0;
  return avg >= minHours;
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
