/**
 * Aggregation hooks that wrap `lib/scoring.ts` + `lib/dashboard-stats.ts`
 * in React Query so screens get cached + auto-invalidating score maps
 * without plumbing useEffect/useState everywhere.
 *
 * All of these hit local SQLite via the scoring module. React Query keys
 * include the date range so a month-change on a calendar triggers a new
 * fetch; staleTime of 30s keeps a calendar month cheap to re-render.
 */

import { useQuery } from "@tanstack/react-query";
import {
  ENGINES,
  computeTitanPercent,
  getDateRangeScoresForEngine,
  getDateRangeScoresForAllEngines,
  type EngineKey,
} from "@/lib/scoring";
import {
  getWeekScores,
  getWeekComparison,
  getWeekTaskStats,
  type WeekScoreEntry,
  type WeekComparisonEntry,
  type WeekTaskStats,
} from "@/lib/dashboard-stats";
import { listTasks, listCompletionsForDate } from "@/services/tasks";
import { listDateRangeISO, todayISO, addDaysISO, dateToISO } from "@/lib/date";
import { useCurrentUserId } from "@/lib/session";

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const scoreMapKeys = {
  engine: (engine: EngineKey, startKey: string, endKey: string) =>
    ["scoreMap", "engine", engine, startKey, endKey] as const,
  titan: (startKey: string, endKey: string) =>
    ["scoreMap", "titan", startKey, endKey] as const,
};

export const dashboardKeys = {
  week: (todayKey: string) => ["dashboard", "week", todayKey] as const,
};

export const analyticsKeys = {
  range: (rangeStart: string, rangeEnd: string) =>
    ["analytics", rangeStart, rangeEnd] as const,
};

// ─── Score maps (calendars) ─────────────────────────────────────────────────

export function useMonthScoreMap(
  engine: EngineKey,
  startKey: string,
  endKey: string,
): Record<string, number> {
  const userId = useCurrentUserId();
  const { data } = useQuery({
    queryKey: scoreMapKeys.engine(engine, startKey, endKey),
    queryFn: async () => {
      const entries = await getDateRangeScoresForEngine(engine, startKey, endKey);
      const map: Record<string, number> = {};
      for (const e of entries) {
        if (e.score.pointsTotal > 0) map[e.dateKey] = e.score.percent;
      }
      return map;
    },
    staleTime: 30_000,
    enabled: Boolean(userId),
  });
  return data ?? {};
}

export function useMonthTitanScoreMap(
  startKey: string,
  endKey: string,
): Record<string, number> {
  const userId = useCurrentUserId();
  const { data } = useQuery({
    queryKey: scoreMapKeys.titan(startKey, endKey),
    queryFn: async () => {
      const all = await getDateRangeScoresForAllEngines(startKey, endKey);
      const dates = all.body.map((e) => e.dateKey);
      const map: Record<string, number> = {};
      for (let i = 0; i < dates.length; i++) {
        const dateKey = dates[i];
        const scores = ENGINES.map((engine) => all[engine][i]?.score);
        const hasAny = scores.some((s) => s && s.pointsTotal > 0);
        if (!hasAny) continue;
        map[dateKey] = computeTitanPercent(
          scores.map((s) => ({
            percent: s?.percent ?? 0,
            pointsTotal: s?.pointsTotal ?? 0,
          })),
        );
      }
      return map;
    },
    staleTime: 30_000,
    enabled: Boolean(userId),
  });
  return data ?? {};
}

// ─── Dashboard week data ────────────────────────────────────────────────────

export type DashboardWeekData = {
  sparklines: Record<string, WeekScoreEntry[]>;
  comparison: WeekComparisonEntry[];
  taskStats: WeekTaskStats;
  titanSparkline: { dateKey: string; percent: number; label: string }[];
};

const EMPTY_WEEK: DashboardWeekData = {
  sparklines: { body: [], mind: [], money: [], charisma: [] },
  comparison: [],
  taskStats: { totalCompleted: 0, bestDay: { dateKey: todayISO(), percent: 0 } },
  titanSparkline: [],
};

export function useDashboardWeek(): DashboardWeekData {
  const userId = useCurrentUserId();
  const { data } = useQuery({
    queryKey: dashboardKeys.week(todayISO()),
    queryFn: async () => {
      const end = todayISO();
      const start = addDaysISO(end, -6);

      const [bodyScores, mindScores, moneyScores, charismaScores, comparison, taskStats, allRange] =
        await Promise.all([
          getWeekScores("body"),
          getWeekScores("mind"),
          getWeekScores("money"),
          getWeekScores("charisma"),
          getWeekComparison(),
          getWeekTaskStats(),
          getDateRangeScoresForAllEngines(start, end),
        ]);

      const dates = allRange.body.map((e) => e.dateKey);
      const titanSparkline = dates.map((dateKey, i) => {
        const scores = ENGINES.map((engine) => allRange[engine][i]?.score);
        const percent = computeTitanPercent(
          scores.map((s) => ({
            percent: s?.percent ?? 0,
            pointsTotal: s?.pointsTotal ?? 0,
          })),
        );
        return { dateKey, percent, label: dateKey.slice(5) };
      });

      const result: DashboardWeekData = {
        sparklines: {
          body: bodyScores,
          mind: mindScores,
          money: moneyScores,
          charisma: charismaScores,
        },
        comparison,
        taskStats,
        titanSparkline,
      };
      return result;
    },
    staleTime: 30_000,
    enabled: Boolean(userId),
  });
  return data ?? EMPTY_WEEK;
}

// ─── Analytics snapshot ─────────────────────────────────────────────────────

export type AnalyticsSnapshot = {
  scoresByDate: Record<string, number>;
  engineScoreByDate: Record<EngineKey, Record<string, number>>;
  taskReliability: Array<{ title: string; engine: EngineKey; percent: number }>;
};

const EMPTY_ANALYTICS: AnalyticsSnapshot = {
  scoresByDate: {},
  engineScoreByDate: { body: {}, mind: {}, money: {}, charisma: {} },
  taskReliability: [],
};

export function useAnalyticsSnapshot(
  rangeStart: string,
  rangeEnd: string,
): AnalyticsSnapshot {
  const userId = useCurrentUserId();
  const { data } = useQuery({
    queryKey: analyticsKeys.range(rangeStart, rangeEnd),
    queryFn: async () => {
      const all = await getDateRangeScoresForAllEngines(rangeStart, rangeEnd);
      const dates = all.body.map((e) => e.dateKey);

      const scoresByDate: Record<string, number> = {};
      const engineScoreByDate: Record<EngineKey, Record<string, number>> = {
        body: {},
        mind: {},
        money: {},
        charisma: {},
      };
      for (let i = 0; i < dates.length; i++) {
        const dateKey = dates[i];
        const scores = ENGINES.map((engine) => all[engine][i]?.score);
        const titanPct = computeTitanPercent(
          scores.map((s) => ({
            percent: s?.percent ?? 0,
            pointsTotal: s?.pointsTotal ?? 0,
          })),
        );
        scoresByDate[dateKey] = titanPct;
        for (const engine of ENGINES) {
          engineScoreByDate[engine][dateKey] = all[engine][i]?.score?.percent ?? 0;
        }
      }

      // Task reliability: completed-days / eligible-days per task.
      // Eligible = min(today, rangeEnd) - max(created_at, rangeStart), clamped.
      const tasks = (await listTasks()).filter((t) => t.is_active !== false);
      const rangeDates = listDateRangeISO(rangeStart, rangeEnd);
      const completionsByDate = await Promise.all(
        rangeDates.map((d) => listCompletionsForDate(d)),
      );
      const completionsByTask = new Map<string, Set<string>>();
      for (let i = 0; i < rangeDates.length; i++) {
        for (const c of completionsByDate[i]) {
          let set = completionsByTask.get(c.task_id);
          if (!set) {
            set = new Set();
            completionsByTask.set(c.task_id, set);
          }
          set.add(rangeDates[i]);
        }
      }

      const today = todayISO();
      const taskReliability = tasks.map((task) => {
        const createdKey = dateToISO(new Date(task.created_at));
        const eligibleStart = createdKey > rangeStart ? createdKey : rangeStart;
        const eligibleEnd = today < rangeEnd ? today : rangeEnd;
        let eligibleDays = 0;
        if (eligibleStart <= eligibleEnd) {
          eligibleDays = listDateRangeISO(eligibleStart, eligibleEnd).length;
          const dpw = task.days_per_week ?? 7;
          if (dpw < 7) eligibleDays = Math.ceil((eligibleDays * dpw) / 7);
        }
        const done = completionsByTask.get(task.id)?.size ?? 0;
        const percent =
          eligibleDays > 0 ? Math.min(100, Math.round((done / eligibleDays) * 100)) : 0;
        return {
          title: task.title,
          engine: task.engine as EngineKey,
          percent,
        };
      });

      const snapshot: AnalyticsSnapshot = {
        scoresByDate,
        engineScoreByDate,
        taskReliability,
      };
      return snapshot;
    },
    staleTime: 30_000,
    enabled: Boolean(userId),
  });
  return data ?? EMPTY_ANALYTICS;
}
