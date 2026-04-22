/**
 * Skill-tree progress evaluation (SQLite-backed).
 *
 * Before the local-first migration, completions / habit logs / focus
 * sessions all lived in MMKV under `completions:<engine>:<date>` keys.
 * The evaluator scanned those keys to decide which skill nodes were
 * eligible for unlock. The migration moved that data to SQLite tables
 * (`completions`, `habit_logs`, `focus_sessions`, `sleep_logs`) but the
 * evaluator kept reading from MMKV — so every checker returned 0 and
 * no node ever became "ready". That's the "skill trees always locked"
 * bug.
 *
 * This rewrite takes one SQLite snapshot per evaluation, passes it to
 * pure checker functions, and writes `state='ready'` for any node whose
 * requirement is now met. `evaluateAllTrees` is called from:
 *   - protocol.tsx (evening protocol save)
 *   - engine/[id].tsx (engine mission screen)
 *   - useToggleCompletion.onSettled (task tap)
 *   - useToggleHabit.onSettled (habit tap)
 * …so progress updates as the user plays, not only after evening
 * protocol.
 */

import { sqliteList, sqliteCount } from "../db/sqlite/service-helpers";
import { getTodayKey, addDays } from "./date";
import skillTreeData from "../data/skill-trees.json";
import { queryClient } from "./query-client";
import { skillTreeKeys } from "../hooks/queries/useSkillTree";
import { setSkillNodeReady, type SkillProgress } from "../services/skill-tree";
import { cachedMindTrainingResults } from "./cached-cloud";
import { logError } from "./error-log";
import type { Tables, Enums } from "../types/supabase";

// ─── Snapshot ───────────────────────────────────────────────────────────────

/**
 * Everything a skill-tree evaluation needs, read once. Passed to every
 * requirement checker so they stay pure (no DB calls mid-loop). Exported
 * for tests; production callers go through `loadSnapshot` and
 * `evaluateSkillTreeWithSnapshot`.
 */
export interface EvaluationSnapshot {
  todayKey: string;
  completions: Pick<Tables<"completions">, "engine" | "date_key">[];
  habits: Pick<Tables<"habits">, "id" | "current_chain">[];
  habitLogs: Pick<Tables<"habit_logs">, "date_key">[];
  focusSessions: Pick<Tables<"focus_sessions">, "date_key">[];
  sleepLogs: Pick<Tables<"sleep_logs">, "date_key">[];
  skillRows: SkillProgress[];
  streakCurrent: number;
}

export async function loadSnapshot(
  streakCurrent: number,
): Promise<EvaluationSnapshot> {
  const [completions, habits, habitLogs, focusSessions, sleepLogs, skillRows] =
    await Promise.all([
      sqliteList<Pick<Tables<"completions">, "engine" | "date_key">>(
        "completions",
        { order: "date_key ASC" },
      ),
      sqliteList<Pick<Tables<"habits">, "id" | "current_chain">>("habits", {}),
      sqliteList<Pick<Tables<"habit_logs">, "date_key">>("habit_logs", {}),
      sqliteList<Pick<Tables<"focus_sessions">, "date_key">>(
        "focus_sessions",
        {},
      ),
      sqliteList<Pick<Tables<"sleep_logs">, "date_key">>("sleep_logs", {}),
      sqliteList<SkillProgress>("skill_tree_progress", {}),
    ]);

  return {
    todayKey: getTodayKey(),
    completions,
    habits,
    habitLogs,
    focusSessions,
    sleepLogs,
    skillRows,
    streakCurrent,
  };
}

// ─── Types (internal) ───────────────────────────────────────────────────────

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

export interface EligibleNode {
  nodeId: string;
  name: string;
  branch: string;
  level: number;
}

/**
 * Evaluate a single engine against the given snapshot. Returns the list
 * of nodes newly eligible for unlock (level-1 + any level-N whose
 * level-(N-1) has already been claimed and whose requirement is met).
 *
 * Pure over (engine, snapshot). Safe to call from tests without mocking
 * the filesystem.
 */
export function evaluateSkillTreeWithSnapshot(
  engine: string,
  snapshot: EvaluationSnapshot,
): EligibleNode[] {
  const engineData = TREE_DATA[engine];
  if (!engineData) return [];

  const rowByNodeId = new Map(
    snapshot.skillRows
      .filter((r) => r.engine === engine)
      .map((r) => [r.node_id, r]),
  );
  const newlyEligible: EligibleNode[] = [];

  for (const branch of engineData.branches) {
    for (const levelDef of branch.levels) {
      const row = rowByNodeId.get(levelDef.nodeId);

      // Skip already claimed or ready nodes — no downgrade, no re-mark.
      if (row && (row.state === "claimed" || row.state === "ready")) continue;

      // Prerequisite: previous level must be claimed.
      if (levelDef.level > 1) {
        const prevLevel = branch.levels.find(
          (l) => l.level === levelDef.level - 1,
        );
        if (!prevLevel) continue;
        const prevRow = rowByNodeId.get(prevLevel.nodeId);
        if (!prevRow || prevRow.state !== "claimed") continue;
      }

      if (checkRequirement(levelDef, snapshot, engine, engineData)) {
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
 * Load a snapshot for the given engine and evaluate it. Convenience
 * wrapper for production code; tests prefer `evaluateSkillTreeWithSnapshot`
 * so they can construct snapshots directly.
 */
export async function evaluateSkillTree(
  engine: string,
): Promise<EligibleNode[]> {
  const snapshot = await loadSnapshot(0);
  return evaluateSkillTreeWithSnapshot(engine, snapshot);
}

/** Legacy no-ops kept so existing imports don't break. */
export function initializeEngineTree(_engine: string): void {}
export function initializeAllTrees(): void {}

/**
 * Run the evaluator across all engines. For each newly eligible node,
 * write `state='ready'` so the UI shows the claim button. Invalidates
 * the skill-tree query cache when any writes happen.
 *
 * Fire-and-forget from call sites — the returned promise is awaitable
 * for tests.
 */
export async function evaluateAllTrees(): Promise<
  (EligibleNode & { engine: string })[]
> {
  let snapshot: EvaluationSnapshot;
  try {
    snapshot = await loadSnapshot(0);
  } catch (e) {
    logError("evaluateAllTrees.loadSnapshot", e);
    return [];
  }

  const results: (EligibleNode & { engine: string })[] = [];
  for (const engine of ["body", "mind", "money", "charisma"]) {
    const eligible = evaluateSkillTreeWithSnapshot(engine, snapshot);
    for (const node of eligible) {
      try {
        await setSkillNodeReady({
          node_id: node.nodeId,
          engine: engine as Enums<"engine_key">,
        });
        results.push({ ...node, engine });
      } catch (e) {
        logError("evaluateAllTrees.setReady", e, {
          engine,
          node: node.nodeId,
        });
      }
    }
  }

  if (results.length > 0) {
    queryClient.invalidateQueries({ queryKey: skillTreeKeys.all });
  }
  return results;
}

// ─── Requirement Checkers ───────────────────────────────────────────────────

function checkRequirement(
  def: LevelDef,
  snap: EvaluationSnapshot,
  engine: string,
  engineData: EngineDef,
): boolean {
  switch (def.requirementType) {
    case "streak_days":
      return streakDays(snap) >= def.targetValue;

    case "engine_avg_weeks":
      return engineAvgWeeks(
        snap,
        def.requirementEngine,
        def.targetValue,
        def.threshold ?? 70,
      );

    case "exercise_count":
      return exerciseCount(def.requirementTag ?? "") >= def.targetValue;

    case "exercise_accuracy":
      return exerciseAccuracy(
        def.requirementTag ?? "",
        def.targetValue,
        def.threshold ?? 80,
      );

    case "exercise_categories":
      return exerciseCategories(def.requirementTag ?? "", def.targetValue);

    case "exercise_all_categories":
      return allExerciseCategories(def.requirementTag ?? "");

    case "focus_sessions":
      return snap.focusSessions.length >= def.targetValue;

    case "task_count":
      return taskCount(snap, def.requirementEngine) >= def.targetValue;

    case "boss_complete":
      // Boss completion still lives in MMKV (outside the migration scope).
      // Disabled here until a full rewire; failing-closed means a user
      // won't see a stuck "ready" state on a boss they didn't complete.
      return false;

    case "log_count":
      return snap.completions.length >= def.targetValue;

    case "habit_streak":
      return snap.streakCurrent >= def.targetValue;

    case "habit_completion_rate":
      return habitCompletionRate(
        snap,
        def.targetValue,
        def.threshold ?? 80,
      );

    case "weekly_consistency":
      return weeklyConsistency(snap, def.targetValue);

    case "branch_level_check":
      return branchLevelCheck(
        snap,
        engine,
        engineData,
        def.targetValue,
      );

    case "srs_recall_accuracy":
      // SRS state is in SQLite but no hook reads it yet; gate returns
      // false until the reader is wired up (same behavior as before).
      return false;

    case "focus_daily_avg":
      return focusDailyAvg(snap, def.targetValue, def.threshold ?? 2);

    case "focus_marathon":
      return focusMarathon(snap, def.targetValue);

    case "sleep_avg_weeks":
      return sleepAvgWeeks(snap, def.targetValue);

    default:
      return false;
  }
}

// ─── Helpers (pure over snapshot) ───────────────────────────────────────────

function taskCount(snap: EvaluationSnapshot, engine: string): number {
  return snap.completions.filter((c) => c.engine === engine).length;
}

function completedDates(snap: EvaluationSnapshot): Set<string> {
  const s = new Set<string>();
  for (const c of snap.completions) s.add(c.date_key);
  return s;
}

function streakDays(snap: EvaluationSnapshot): number {
  const dates = completedDates(snap);
  let streak = 0;
  let cursor = snap.todayKey;
  // 365 is a defensive upper bound — no skill node requires more.
  for (let i = 0; i < 365; i++) {
    if (dates.has(cursor)) {
      streak++;
      cursor = addDays(cursor, -1);
    } else {
      break;
    }
  }
  return streak;
}

function engineAvgWeeks(
  snap: EvaluationSnapshot,
  engine: string,
  weeks: number,
  threshold: number,
): boolean {
  const totalDays = weeks * 7;
  const windowStart = addDays(snap.todayKey, -(totalDays - 1));
  const activeDates = new Set<string>();
  for (const c of snap.completions) {
    if (c.engine !== engine) continue;
    if (c.date_key < windowStart || c.date_key > snap.todayKey) continue;
    activeDates.add(c.date_key);
  }
  if (activeDates.size === 0) return false;
  const rate = Math.round((activeDates.size / totalDays) * 100);
  return rate >= threshold;
}

function habitCompletionRate(
  snap: EvaluationSnapshot,
  days: number,
  threshold: number,
): boolean {
  if (days <= 0) return false;
  const windowStart = addDays(snap.todayKey, -(days - 1));
  const activeDates = new Set<string>();
  for (const l of snap.habitLogs) {
    if (l.date_key < windowStart || l.date_key > snap.todayKey) continue;
    activeDates.add(l.date_key);
  }
  const rate = Math.round((activeDates.size / days) * 100);
  return rate >= threshold;
}

function weeklyConsistency(
  snap: EvaluationSnapshot,
  targetWeeks: number,
): boolean {
  const dates = completedDates(snap);
  let weeksWithActivity = 0;
  // Scan `targetWeeks + 2` windows, counting any week that had any day
  // active. +2 gives the user a little head-room — the same behavior as
  // the old MMKV-backed checker.
  for (let w = 0; w < targetWeeks + 2; w++) {
    let weekActive = false;
    for (let d = 0; d < 7; d++) {
      const dk = addDays(snap.todayKey, -(w * 7 + d));
      if (dates.has(dk)) {
        weekActive = true;
        break;
      }
    }
    if (weekActive) weeksWithActivity++;
  }
  return weeksWithActivity >= targetWeeks;
}

function focusDailyAvg(
  snap: EvaluationSnapshot,
  days: number,
  minSessions: number,
): boolean {
  if (days <= 0) return false;
  const windowStart = addDays(snap.todayKey, -(days - 1));
  let count = 0;
  for (const f of snap.focusSessions) {
    if (f.date_key < windowStart || f.date_key > snap.todayKey) continue;
    count++;
  }
  return count / days >= minSessions;
}

function focusMarathon(
  snap: EvaluationSnapshot,
  targetDays: number,
): boolean {
  const dates = new Set(snap.focusSessions.map((f) => f.date_key));
  return dates.size >= targetDays;
}

function sleepAvgWeeks(
  snap: EvaluationSnapshot,
  weeks: number,
): boolean {
  if (weeks <= 0) return false;
  const totalDays = weeks * 7;
  const windowStart = addDays(snap.todayKey, -(totalDays - 1));
  const activeDates = new Set<string>();
  for (const l of snap.sleepLogs) {
    if (l.date_key < windowStart || l.date_key > snap.todayKey) continue;
    activeDates.add(l.date_key);
  }
  const rate = Math.round((activeDates.size / totalDays) * 100);
  // Matches the legacy checker: "at least half the days logged" counts as
  // the goal met. The `minHours` parameter was never honored (sleep_logs
  // doesn't have per-day hour sums in the check), kept for compat.
  return rate >= 50;
}

function branchLevelCheck(
  snap: EvaluationSnapshot,
  engine: string,
  engineData: EngineDef,
  minLevel: number,
): boolean {
  const engineRows = snap.skillRows.filter((r) => r.engine === engine);
  const nodeMeta = new Map<string, { branchId: string; level: number }>();
  for (const branch of engineData.branches) {
    for (const lv of branch.levels) {
      nodeMeta.set(lv.nodeId, { branchId: branch.id, level: lv.level });
    }
  }
  for (const branch of engineData.branches) {
    const hasLevel = engineRows.some((r) => {
      if (r.state !== "claimed") return false;
      const meta = nodeMeta.get(r.node_id);
      return Boolean(
        meta && meta.branchId === branch.id && meta.level >= minLevel,
      );
    });
    if (!hasLevel) return false;
  }
  return true;
}

// ─── Mind-training helpers (still read from React Query cache) ─────────────
// These haven't moved to the snapshot because mind_training_results is
// already a React Query-cached table and the existing read pattern is
// good enough. Switching them to SQLite is a clean follow-up.

function exerciseCount(tag: string): number {
  const history = cachedMindTrainingResults();
  return history.filter((r) => r.type === tag || tag === "").length;
}

function exerciseAccuracy(
  tag: string,
  minCount: number,
  threshold: number,
): boolean {
  const history = cachedMindTrainingResults();
  const filtered = history.filter((r) => r.type === tag || tag === "");
  if (filtered.length < minCount) return false;
  const correct = filtered.filter((r) => r.correct).length;
  return Math.round((correct / filtered.length) * 100) >= threshold;
}

function exerciseCategories(tag: string, target: number): boolean {
  const history = cachedMindTrainingResults();
  const filtered = history.filter((r) => r.type === tag && r.correct);
  return new Set(filtered.map((r) => r.category)).size >= target;
}

function allExerciseCategories(tag: string): boolean {
  const history = cachedMindTrainingResults();
  const filtered = history.filter((r) => r.type === tag && r.correct);
  return new Set(filtered.map((r) => r.category)).size >= 5;
}

// ─── Test-only ─────────────────────────────────────────────────────────────

/** Expose internals for tests only. Don't use from production code. */
export const __internal = {
  streakDays,
  engineAvgWeeks,
  habitCompletionRate,
  weeklyConsistency,
  focusDailyAvg,
  focusMarathon,
  sleepAvgWeeks,
  branchLevelCheck,
  taskCount,
  completedDates,
};

// Keep the sqliteCount import usable for any future call site that
// prefers the direct count path.
void sqliteCount;
