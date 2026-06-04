/**
 * Centralized scoring module for Titan Protocol.
 *
 * This file is the canonical source of truth for all score computation:
 * - main task = 2 points
 * - secondary task = 1 point
 * - engine score = completed points / total points
 * - Titan score = average of active engine scores
 */

// scoring.ts provides pure computation helpers + async aggregators that
// read directly from the local SQLite store via service-helpers.

import {
  addDaysISO,
  assertDateISO,
  listDateRangeISO,
  monthBounds,
  todayISO,
  weekStartISO,
} from "./date";
import { sqliteList } from "../db/sqlite/service-helpers";
import { listTasksByEngine, type Completion } from "../services/tasks";

export type EngineKey = "body" | "mind" | "money" | "charisma";

export type DayScore = {
  percent: number;
  mainDone: number;
  mainTotal: number;
  secondaryDone: number;
  secondaryTotal: number;
  pointsDone: number;
  pointsTotal: number;
};

export type DateScoreEntry = {
  dateKey: string;
  score: DayScore;
};

export type EngineRangeScores = DateScoreEntry[];

export type AllEnginesRangeScores = Record<EngineKey, EngineRangeScores>;

export type ConsistencyResult = {
  percent: number;
  consistentDays: number;
  totalDays: number;
  currentStreak: number;
  bestStreak: number;
};

export type TitanScore = {
  percent: number;
  perEngine: Record<EngineKey, DayScore>;
  enginesActiveCount: number;
};

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

export const EMPTY_SCORE: DayScore = {
  percent: 0,
  mainDone: 0,
  mainTotal: 0,
  secondaryDone: 0,
  secondaryTotal: 0,
  pointsDone: 0,
  pointsTotal: 0,
};

// ─── Simplified types for pure computation (no DB) ─────────────────────────

type Task = {
  id?: string;
  engine: EngineKey;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
  daysPerWeek?: number;
  isActive?: boolean;
};

type EngineSnapshot = {
  tasks: Task[];
  completionsByDate: Map<string, Set<string>>;
  completionsByTask: Map<string, Set<string>>;
};

// ─── Pure helpers ───────────────────────────────────────────────────────────

export function computeDayScoreFromCounts(
  mainTotal: number,
  mainDone: number,
  secondaryTotal: number,
  secondaryDone: number,
): DayScore {
  const pointsTotal = mainTotal * 2 + secondaryTotal;
  const pointsDone = mainDone * 2 + secondaryDone;
  const percent = pointsTotal === 0 ? 0 : Math.round((pointsDone / pointsTotal) * 100);
  return { percent, mainDone, mainTotal, secondaryDone, secondaryTotal, pointsDone, pointsTotal };
}

export function computeTitanPercent(scores: ReadonlyArray<Pick<DayScore, "percent" | "pointsTotal">>): number {
  const active = scores.filter((score) => score.pointsTotal > 0);
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, score) => acc + score.percent, 0);
  return Math.round(sum / active.length);
}

function emptyAllEngineScores(): AllEnginesRangeScores {
  return { body: [], mind: [], money: [], charisma: [] };
}

// ─── Snapshot loader — reads from local SQLite ─────────────────────────────

async function loadEngineSnapshot(
  engine: EngineKey,
  historyStart: string,
  historyEnd: string,
): Promise<EngineSnapshot> {
  // Tasks that match the engine. `listTasksByEngine` returns live rows
  // (`_deleted = 0`) with booleans already coerced by service-helpers.
  const dbTasks = await listTasksByEngine(engine);

  // Every completion for this engine within the reporting window. We pull
  // from `weekStart` rather than `startDate` so the caller can enforce the
  // `daysPerWeek` cap — a task with days_per_week=3 that's already hit its
  // weekly quota should not contribute to a later day's score.
  const dbCompletions = await sqliteList<Completion>("completions", {
    where: "engine = ? AND date_key >= ? AND date_key <= ?",
    params: [engine, historyStart, historyEnd],
  });

  const tasks: Task[] = dbTasks
    .filter((t) => t.is_active !== false)
    .map((t) => ({
      id: t.id,
      engine: t.engine as EngineKey,
      title: t.title,
      kind: (t.kind ?? "main") as "main" | "secondary",
      createdAt: Date.parse(t.created_at),
      daysPerWeek: t.days_per_week ?? 7,
      isActive: t.is_active !== false,
    }));

  const completionsByDate = new Map<string, Set<string>>();
  const completionsByTask = new Map<string, Set<string>>();
  for (const c of dbCompletions) {
    let set = completionsByDate.get(c.date_key);
    if (!set) {
      set = new Set();
      completionsByDate.set(c.date_key, set);
    }
    set.add(c.task_id);

    let taskSet = completionsByTask.get(c.task_id);
    if (!taskSet) {
      taskSet = new Set();
      completionsByTask.set(c.task_id, taskSet);
    }
    taskSet.add(c.date_key);
  }

  return { tasks, completionsByDate, completionsByTask };
}

function countWeeklyCompletions(
  taskId: string,
  weekStart: string,
  dateKey: string,
  completionsByTask: Map<string, Set<string>>,
): number {
  const dates = completionsByTask.get(taskId);
  if (!dates) return 0;
  let count = 0;
  for (const d of dates) {
    if (d >= weekStart && d < dateKey) count++;
  }
  return count;
}

function computeScoreForDate(snapshot: EngineSnapshot, dateKey: string): DayScore {
  const weekStart = weekStartISO(dateKey);
  const done = snapshot.completionsByDate.get(dateKey) ?? new Set<string>();

  let mainTotal = 0;
  let mainDone = 0;
  let secondaryTotal = 0;
  let secondaryDone = 0;

  for (const task of snapshot.tasks) {
    const daysPerWeek = task.daysPerWeek ?? 7;
    if (daysPerWeek < 7) {
      const weekCount = countWeeklyCompletions(task.id!, weekStart, dateKey, snapshot.completionsByTask);
      if (weekCount >= daysPerWeek) continue;
    }

    if (task.kind === "main") {
      mainTotal++;
      if (done.has(task.id!)) mainDone++;
    } else {
      secondaryTotal++;
      if (done.has(task.id!)) secondaryDone++;
    }
  }

  return computeDayScoreFromCounts(mainTotal, mainDone, secondaryTotal, secondaryDone);
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getDateRangeScoresForEngine(
  engine: EngineKey,
  startDate: string,
  endDate: string,
): Promise<EngineRangeScores> {
  const safeStart = assertDateISO(startDate);
  const safeEnd = assertDateISO(endDate);
  if (safeStart > safeEnd) return [];

  const historyStart = weekStartISO(safeStart);
  const dateKeys = listDateRangeISO(safeStart, safeEnd);
  const snapshot = await loadEngineSnapshot(engine, historyStart, safeEnd);
  return dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(snapshot, dateKey) }));
}

export async function getDateRangeScoresForAllEngines(
  startDate: string,
  endDate: string,
): Promise<AllEnginesRangeScores> {
  const safeStart = assertDateISO(startDate);
  const safeEnd = assertDateISO(endDate);
  if (safeStart > safeEnd) return emptyAllEngineScores();

  const historyStart = weekStartISO(safeStart);
  const dateKeys = listDateRangeISO(safeStart, safeEnd);

  const [bodySnapshot, mindSnapshot, moneySnapshot, charismaSnapshot] = await Promise.all([
    loadEngineSnapshot("body", historyStart, safeEnd),
    loadEngineSnapshot("mind", historyStart, safeEnd),
    loadEngineSnapshot("money", historyStart, safeEnd),
    loadEngineSnapshot("charisma", historyStart, safeEnd),
  ]);

  return {
    body: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(bodySnapshot, dateKey) })),
    mind: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(mindSnapshot, dateKey) })),
    money: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(moneySnapshot, dateKey) })),
    charisma: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(charismaSnapshot, dateKey) })),
  };
}

export async function getDayScoreForEngine(engine: EngineKey, dateKey: string): Promise<DayScore> {
  const safeDate = assertDateISO(dateKey);
  const [entry] = await getDateRangeScoresForEngine(engine, safeDate, safeDate);
  return entry?.score ?? EMPTY_SCORE;
}

export async function getDayScoresForDate(dateKey: string): Promise<Record<EngineKey, DayScore>> {
  const safeDate = assertDateISO(dateKey);
  const all = await getDateRangeScoresForAllEngines(safeDate, safeDate);
  return {
    body: all.body[0]?.score ?? EMPTY_SCORE,
    mind: all.mind[0]?.score ?? EMPTY_SCORE,
    money: all.money[0]?.score ?? EMPTY_SCORE,
    charisma: all.charisma[0]?.score ?? EMPTY_SCORE,
  };
}

export async function getMonthConsistencyForEngine(
  engine: EngineKey,
  monthKey: string,
): Promise<ConsistencyResult> {
  const safe = assertDateISO(monthKey);
  const { start, end } = monthBounds(safe);
  const monthEndInclusive = addDaysISO(end, -1);

  const monthlyScores = await getDateRangeScoresForEngine(engine, start, monthEndInclusive);
  const scoreMap: Record<string, number> = {};
  for (const entry of monthlyScores) {
    if (entry.score.pointsTotal > 0) {
      scoreMap[entry.dateKey] = entry.score.percent;
    }
  }

  const now = todayISO();
  const effectiveEnd = now < end ? now : monthEndInclusive;

  const result = computeMonthConsistency(scoreMap, start, effectiveEnd, start, effectiveEnd, 60);
  return {
    percent: result.consistencyPct,
    consistentDays: result.consistentDays,
    totalDays: result.daysElapsed,
    currentStreak: result.currentStreak,
    bestStreak: result.bestStreak,
  };
}

export async function getTitanScoreForDate(dateKey: string): Promise<TitanScore> {
  const perEngine = await getDayScoresForDate(dateKey);
  const percent = computeTitanPercent(ENGINES.map((engine) => perEngine[engine]));
  const enginesActiveCount = ENGINES.filter((engine) => perEngine[engine].pointsTotal > 0).length;
  return { percent, perEngine, enginesActiveCount };
}

export type MonthConsistencyResult = {
  consistencyPct: number;
  consistentDays: number;
  daysElapsed: number;
  currentStreak: number;
  bestStreak: number;
};

/**
 * Pure computation of monthly consistency from a pre-built score map.
 * Shared across Body, Mind, Money, General, and Command Center pages.
 *
 * `dataStartKey` clamps the start of the consistency window forward so
 * days before the user's first task in this engine never count against
 * them. Pass `""` to disable (consistency starts at `monthStartKey`).
 *
 * `resetAfterIdleDays` resets the window forward when a long break
 * occurs: a run of N consecutive zero-activity days (scoreMap value
 * `0`/missing) restarts the window at the first active day after the
 * gap. A returning user shouldn't be penalized for the months they
 * weren't engaged. Pass `0` to disable. Default `30` days.
 */
export function computeMonthConsistency(
  scoreMap: Record<string, number>,
  monthStartKey: string,
  monthEndKey: string,
  dataStartKey: string,
  referenceKey: string,
  threshold = 60,
  resetAfterIdleDays = 30,
): MonthConsistencyResult {
  const rawStart = dataStartKey && dataStartKey > monthStartKey ? dataStartKey : monthStartKey;
  const effectiveEnd = referenceKey < monthEndKey ? referenceKey : monthEndKey;

  if (!rawStart || rawStart > effectiveEnd) {
    return { consistencyPct: 0, consistentDays: 0, daysElapsed: 0, currentStreak: 0, bestStreak: 0 };
  }

  const fullRange = listDateRangeISO(rawStart, effectiveEnd);

  let windowStartIdx = 0;
  if (resetAfterIdleDays > 0) {
    let idleRun = 0;
    for (let i = 0; i < fullRange.length; i += 1) {
      const isActive = (scoreMap[fullRange[i]!] ?? 0) > 0;
      if (isActive) {
        if (idleRun >= resetAfterIdleDays) windowStartIdx = i;
        idleRun = 0;
      } else {
        idleRun += 1;
      }
    }
  }

  const days = fullRange.slice(windowStartIdx);
  let daysElapsed = 0;
  let consistentDays = 0;
  let bestStreak = 0;
  let runningStreak = 0;

  for (const dateKey of days) {
    daysElapsed += 1;
    if ((scoreMap[dateKey] ?? 0) >= threshold) {
      consistentDays += 1;
      runningStreak += 1;
      if (runningStreak > bestStreak) bestStreak = runningStreak;
    } else {
      runningStreak = 0;
    }
  }

  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    if ((scoreMap[days[i]!] ?? 0) >= threshold) {
      currentStreak += 1;
    } else {
      break;
    }
  }

  const consistencyPct = daysElapsed === 0 ? 0 : Math.round((consistentDays / daysElapsed) * 100);
  return { consistencyPct, consistentDays, daysElapsed, currentStreak, bestStreak };
}
