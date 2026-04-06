/**
 * Centralized scoring module for Titan Protocol.
 *
 * This file is the canonical source of truth for all score computation:
 * - main task = 2 points
 * - secondary task = 1 point
 * - engine score = completed points / total points
 * - Titan score = average of active engine scores
 */

import { db, type Task, type Completion } from "./db";
import { withScoreCache } from "./score-cache";
import {
  addDaysISO,
  assertDateISO,
  listDateRangeISO,
  monthBounds,
  todayISO,
  weekStartISO,
} from "./date";

export type EngineKey = "body" | "mind" | "money" | "general";

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

export const ENGINES: EngineKey[] = ["body", "mind", "money", "general"];

export const EMPTY_SCORE: DayScore = {
  percent: 0,
  mainDone: 0,
  mainTotal: 0,
  secondaryDone: 0,
  secondaryTotal: 0,
  pointsDone: 0,
  pointsTotal: 0,
};

// ─── Unified snapshot type ──────────────────────────────────────────────────

type EngineSnapshot = {
  tasks: Task[];
  completionsByDate: Map<string, Set<number>>;
  /** For daysPerWeek logic: all completions in the range keyed by taskId → set of dateKeys */
  completionsByTask: Map<number, Set<string>>;
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
  return { body: [], mind: [], money: [], general: [] };
}

// ─── Unified snapshot loader ────────────────────────────────────────────────

async function loadEngineSnapshot(
  engine: EngineKey,
  historyStart: string,
  historyEnd: string,
): Promise<EngineSnapshot> {
  const [tasks, completions] = await Promise.all([
    db.tasks.where({ engine }).filter((t) => t.isActive !== false).toArray(),
    db.completions.where("[engine+dateKey]").between([engine, historyStart], [engine, historyEnd], true, true).toArray(),
  ]);

  const completionsByDate = new Map<string, Set<number>>();
  const completionsByTask = new Map<number, Set<string>>();

  for (const c of completions) {
    // by date
    const dateSet = completionsByDate.get(c.dateKey) ?? new Set<number>();
    dateSet.add(c.taskId);
    completionsByDate.set(c.dateKey, dateSet);
    // by task
    const taskSet = completionsByTask.get(c.taskId) ?? new Set<string>();
    taskSet.add(c.dateKey);
    completionsByTask.set(c.taskId, taskSet);
  }

  return { tasks, completionsByDate, completionsByTask };
}

function countWeeklyCompletions(
  taskId: number,
  weekStart: string,
  dateKey: string,
  completionsByTask: Map<number, Set<string>>,
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
  const done = snapshot.completionsByDate.get(dateKey) ?? new Set<number>();

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

  return withScoreCache(`range:${engine}:${safeStart}:${safeEnd}`, async () => {
    const historyStart = weekStartISO(safeStart);
    const dateKeys = listDateRangeISO(safeStart, safeEnd);
    const snapshot = await loadEngineSnapshot(engine, historyStart, safeEnd);
    return dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(snapshot, dateKey) }));
  });
}

export async function getDateRangeScoresForAllEngines(
  startDate: string,
  endDate: string,
): Promise<AllEnginesRangeScores> {
  const safeStart = assertDateISO(startDate);
  const safeEnd = assertDateISO(endDate);
  if (safeStart > safeEnd) return emptyAllEngineScores();

  return withScoreCache(`allRange:${safeStart}:${safeEnd}`, async () => {
    const historyStart = weekStartISO(safeStart);
    const dateKeys = listDateRangeISO(safeStart, safeEnd);

    const [bodySnapshot, mindSnapshot, moneySnapshot, generalSnapshot] = await Promise.all([
      loadEngineSnapshot("body", historyStart, safeEnd),
      loadEngineSnapshot("mind", historyStart, safeEnd),
      loadEngineSnapshot("money", historyStart, safeEnd),
      loadEngineSnapshot("general", historyStart, safeEnd),
    ]);

    return {
      body: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(bodySnapshot, dateKey) })),
      mind: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(mindSnapshot, dateKey) })),
      money: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(moneySnapshot, dateKey) })),
      general: dateKeys.map((dateKey) => ({ dateKey, score: computeScoreForDate(generalSnapshot, dateKey) })),
    };
  });
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
    general: all.general[0]?.score ?? EMPTY_SCORE,
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
 */
export function computeMonthConsistency(
  scoreMap: Record<string, number>,
  monthStartKey: string,
  monthEndKey: string,
  dataStartKey: string,
  referenceKey: string,
  threshold = 60,
): MonthConsistencyResult {
  const effectiveStart = dataStartKey && dataStartKey > monthStartKey ? dataStartKey : monthStartKey;
  const effectiveEnd = referenceKey < monthEndKey ? referenceKey : monthEndKey;

  if (!effectiveStart || effectiveStart > effectiveEnd) {
    return { consistencyPct: 0, consistentDays: 0, daysElapsed: 0, currentStreak: 0, bestStreak: 0 };
  }

  const days = listDateRangeISO(effectiveStart, effectiveEnd);
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
