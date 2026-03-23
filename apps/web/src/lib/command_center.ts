import { db, type Task, type EngineKey } from "./db";
import { assertDateISO, isDateInRangeISO, todayISO } from "./date";
import { addBodyTask, toggleBodyTaskForDate } from "./body";
import { addMindTask, setMindTaskCompletion } from "./mind";
import { addMoneyTask, toggleMoneyTaskForDate } from "./money";
import { addGeneralTask, toggleGeneralTaskForDate } from "./general";
import { computeDayScoreFromCounts } from "./scoring";

export type UnifiedTask = {
  id: string;
  engine: EngineKey;
  rawId: number;
  title: string;
  kind: "main" | "secondary";
  createdAt: number;
};

export type UnifiedTaskDraft = {
  engine: UnifiedTask["engine"];
  title: string;
  kind: UnifiedTask["kind"];
  daysPerWeek?: number;
  dateISO?: string;
};

export async function listAllTasks(): Promise<UnifiedTask[]> {
  const allTasks = await db.tasks.where("engine").anyOf(["body", "mind", "money", "general"]).filter((t) => t.isActive !== false).toArray();

  return allTasks
    .filter((task) => typeof task.id === "number")
    .map((task) => ({
      id: `${task.engine}:${task.id}`,
      engine: task.engine,
      rawId: task.id as number,
      title: task.title,
      kind: task.kind,
      createdAt: task.createdAt,
    }));
}

export async function getCompletionMap(dateISO: string): Promise<Set<string>> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const completions = await db.completions.where("dateKey").equals(safeDate).toArray();

  const set = new Set<string>();
  for (const c of completions) {
    set.add(`${c.engine}:${c.taskId}`);
  }
  return set;
}

export async function getCompletionMapForRange(startISO: string, endISO: string) {
  const safeStart = assertDateISO(startISO);
  const safeEnd = assertDateISO(endISO);
  const map = new Map<string, Set<string>>();

  const completions = await db.completions.toArray();

  for (const c of completions) {
    if (typeof c.dateKey !== "string") continue;
    if (!isDateInRangeISO(c.dateKey, safeStart, safeEnd)) continue;
    const set = map.get(c.dateKey) ?? new Set<string>();
    set.add(`${c.engine}:${c.taskId}`);
    map.set(c.dateKey, set);
  }

  return map;
}

export async function toggleTaskCompletion(normalizedId: string, dateISO: string, completed?: boolean) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const [engine, raw] = normalizedId.split(":");
  if (!engine || raw === undefined) return;

  if (engine === "mind") {
    const next = completed ? false : true;
    await setMindTaskCompletion(safeDate, Number(raw), next);
    return;
  }
  if (engine === "body") {
    await toggleBodyTaskForDate(safeDate, Number(raw));
    return;
  }
  if (engine === "money") {
    await toggleMoneyTaskForDate(safeDate, Number(raw));
    return;
  }
  if (engine === "general") {
    await toggleGeneralTaskForDate(safeDate, Number(raw));
  }
}

export async function addTaskToEngine(draft: UnifiedTaskDraft): Promise<void> {
  const title = draft.title.trim();
  if (!title) {
    throw new Error("Task title is required.");
  }
  const safeDays = Math.min(7, Math.max(1, Math.floor(draft.daysPerWeek ?? 7)));

  if (draft.engine === "body") {
    await addBodyTask(title, draft.kind, safeDays);
    return;
  }
  if (draft.engine === "money") {
    await addMoneyTask(title, draft.kind, safeDays);
    return;
  }
  if (draft.engine === "general") {
    await addGeneralTask(title, draft.kind, safeDays);
    return;
  }
  if (draft.engine === "mind") {
    await addMindTask({
      title,
      kind: draft.kind,
      daysPerWeek: safeDays,
      dateISO: draft.dateISO ?? todayISO(),
    });
    return;
  }
  throw new Error("Unsupported engine.");
}

export function computeDayScore(tasks: UnifiedTask[], completionSet: Set<string>) {
  const mainTasks = tasks.filter((task) => task.kind === "main");
  const secondaryTasks = tasks.filter((task) => task.kind === "secondary");

  const mainDone = mainTasks.filter((task) => completionSet.has(task.id)).length;
  const secondaryDone = secondaryTasks.filter((task) => completionSet.has(task.id)).length;
  return computeDayScoreFromCounts(mainTasks.length, mainDone, secondaryTasks.length, secondaryDone);
}
