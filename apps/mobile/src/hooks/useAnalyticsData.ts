import { useMemo, useEffect } from "react";
import { useEngineStore, ENGINES, selectTotalScore } from "../stores/useEngineStore";
import type { EngineKey } from "../db/schema";

function getDateKey(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function getDateRange(daysBack: number): { start: string; end: string } {
  return { start: getDateKey(daysBack - 1), end: getDateKey(0) };
}

export function useAnalyticsData() {
  const loadDateRange = useEngineStore((s) => s.loadDateRange);
  const loadAllEngines = useEngineStore((s) => s.loadAllEngines);
  const scores = useEngineStore((s) => s.scores);
  const tasks = useEngineStore((s) => s.tasks);
  const completions = useEngineStore((s) => s.completions);

  const today = getDateKey(0);

  // Load 84 days of data for heatmap + 7 days for sparklines + this/last week
  useEffect(() => {
    loadAllEngines(today);
    const range = getDateRange(84);
    loadDateRange(range.start, range.end);
  }, [today]);

  // Engine scores for today
  const engineScores = useMemo(() => {
    return Object.fromEntries(
      ENGINES.map((e) => [e, scores[`${e}:${today}`] ?? 0])
    ) as Record<EngineKey, number>;
  }, [scores, today]);

  const titanScore = useMemo(() => selectTotalScore(scores, today), [scores, today]);

  // Active engine count
  const activeEngines = useMemo(() => {
    return ENGINES.filter((e) => (tasks[e]?.length ?? 0) > 0).length;
  }, [tasks]);

  // 7-day sparkline data per engine
  const sparklineData = useMemo(() => {
    const result: Record<EngineKey, number[]> = { body: [], mind: [], money: [], general: [] };
    for (let i = 6; i >= 0; i--) {
      const dk = getDateKey(i);
      for (const e of ENGINES) {
        result[e].push(scores[`${e}:${dk}`] ?? 0);
      }
    }
    return result;
  }, [scores]);

  // This week stats (Mon-today)
  const thisWeek = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const daysInWeek = mondayOffset + 1;

    let totalScore = 0;
    let totalTasks = 0;
    let bestScore = 0;
    let bestDay = today;
    let activeDays = 0;

    for (let i = 0; i < daysInWeek; i++) {
      const dk = getDateKey(mondayOffset - i);
      const dayScore = selectTotalScore(scores, dk);
      if (dayScore > 0) activeDays++;
      totalScore += dayScore;
      if (dayScore > bestScore) {
        bestScore = dayScore;
        bestDay = dk;
      }
      // Count completed tasks
      for (const e of ENGINES) {
        const ids = completions[`${e}:${dk}`];
        if (ids) totalTasks += ids.length;
      }
    }

    return {
      avgScore: activeDays > 0 ? Math.round(totalScore / daysInWeek) : 0,
      tasksCompleted: totalTasks,
      bestDayScore: bestScore,
      bestDayDate: bestDay,
    };
  }, [scores, completions, today]);

  // Last week stats (for comparison)
  const lastWeek = useMemo(() => {
    const result: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, general: 0 };
    let count = 0;
    for (let i = 7; i <= 13; i++) {
      const dk = getDateKey(i);
      for (const e of ENGINES) {
        result[e] += scores[`${e}:${dk}`] ?? 0;
      }
      count++;
    }
    for (const e of ENGINES) {
      result[e] = count > 0 ? Math.round(result[e] / count) : 0;
    }
    return result;
  }, [scores]);

  // This week engine averages (for comparison)
  const thisWeekEngines = useMemo(() => {
    const result: Record<EngineKey, number> = { body: 0, mind: 0, money: 0, general: 0 };
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const daysInWeek = mondayOffset + 1;

    for (let i = 0; i < daysInWeek; i++) {
      const dk = getDateKey(mondayOffset - i);
      for (const e of ENGINES) {
        result[e] += scores[`${e}:${dk}`] ?? 0;
      }
    }
    for (const e of ENGINES) {
      result[e] = daysInWeek > 0 ? Math.round(result[e] / daysInWeek) : 0;
    }
    return result;
  }, [scores]);

  // Heatmap data (84 days)
  const heatmapData = useMemo(() => {
    const data: { dateKey: string; score: number }[] = [];
    for (let i = 83; i >= 0; i--) {
      const dk = getDateKey(i);
      data.push({ dateKey: dk, score: selectTotalScore(scores, dk) });
    }
    return data;
  }, [scores]);

  return {
    today,
    titanScore,
    engineScores,
    activeEngines,
    sparklineData,
    thisWeek,
    lastWeek,
    thisWeekEngines,
    heatmapData,
  };
}
