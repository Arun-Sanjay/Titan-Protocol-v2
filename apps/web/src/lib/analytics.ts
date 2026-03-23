import { db, type Task, type EngineKey } from "./db";
import { assertDateISO, isDateInRangeISO } from "./date";
import { computeDayScoreFromCounts, computeTitanPercent, type DayScore } from "./scoring";

export type EngineId = EngineKey;

export type EngineTask = {
  id: number;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
};

export type EngineCompletion = {
  dateISO: string;
  taskId: number;
};

export type DailyScore = DayScore;

export function listEngines(): EngineId[] {
  return ["body", "mind", "money", "general"];
}

export async function getAllTasksByEngine(): Promise<Record<EngineId, EngineTask[]>> {
  const allTasks = await db.tasks.where("engine").anyOf(["body", "mind", "money", "general"]).filter((t) => t.isActive !== false).toArray();

  const result: Record<EngineId, EngineTask[]> = { body: [], mind: [], money: [], general: [] };
  for (const task of allTasks) {
    result[task.engine].push({
      id: task.id ?? 0,
      title: task.title,
      kind: task.kind,
      createdAt: task.createdAt,
    });
  }
  return result;
}

export async function getCompletionsByEngineForRange(
  startISO: string,
  endISO: string,
): Promise<Record<EngineId, EngineCompletion[]>> {
  const safeStart = assertDateISO(startISO);
  const safeEnd = assertDateISO(endISO);

  const completions = await db.completions.toArray();
  const inRange = (dateISO: string) => isDateInRangeISO(dateISO, safeStart, safeEnd, { endInclusive: false });

  const result: Record<EngineId, EngineCompletion[]> = { body: [], mind: [], money: [], general: [] };
  for (const c of completions) {
    if (typeof c.dateKey !== "string") continue;
    if (!inRange(c.dateKey)) continue;
    result[c.engine].push({ dateISO: c.dateKey, taskId: c.taskId });
  }
  return result;
}

export function computeDailyScore(tasks: EngineTask[], completionSet: Set<string | number>): DailyScore {
  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completionSet.has(task.id)).length;
  const secondaryDone = secondaryTasks.filter((task) => completionSet.has(task.id)).length;
  return computeDayScoreFromCounts(mainTasks.length, mainDone, secondaryTasks.length, secondaryDone);
}

export function titanDailyScore(scores: Record<EngineId, DailyScore>) {
  return computeTitanPercent(listEngines().map((engine) => scores[engine]));
}
