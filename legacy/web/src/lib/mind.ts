import { createEngineTaskLogHelpers, ensureEngineMeta, getEngineStartDate, touchEngineDate, db, type MindTask, type MindMeta, type Completion } from "./db";
import { computeBodyDayScore } from "./bodyScore";
import { assertDateISO, todayISO } from "./date";

export type { MindMeta };

export async function ensureMindMeta(dateISO: string): Promise<MindMeta> {
  return ensureEngineMeta("mind", dateISO) as Promise<MindMeta>;
}

export async function getMindStartDate(): Promise<string | null> {
  return getEngineStartDate("mind");
}

export async function listMindTasks(): Promise<MindTask[]> {
  return mindTaskLog.listTasks();
}

export async function addMindTask({
  title,
  kind,
  dateISO,
  daysPerWeek = 7,
}: {
  title: string;
  kind: "main" | "secondary";
  dateISO?: string;
  daysPerWeek?: number;
}): Promise<MindTask & { id: number }> {
  const id = await mindTaskLog.addTask(title, kind, daysPerWeek);
  if (dateISO) {
    await ensureMindMeta(assertDateISO(dateISO));
  }
  return { id, engine: "mind", title, kind, createdAt: Date.now(), daysPerWeek, isActive: true };
}

export async function deleteMindTask(taskId: string | number): Promise<void> {
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;
  if (!numId) return;
  await mindTaskLog.deleteTask(numId);
}

export async function updateMindTaskKind(taskId: string | number, kind: "main" | "secondary"): Promise<void> {
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;
  if (!numId) return;
  await mindTaskLog.updateTaskPriority(numId, kind);
}

export async function renameMindTask(taskId: string | number, title: string): Promise<void> {
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;
  if (!numId) return;
  await mindTaskLog.renameTask(numId, title);
}

export async function listMindCompletions(dateISO: string): Promise<Completion[]> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  return db.completions.where("[engine+dateKey]").equals(["mind", safeDate]).toArray();
}

/**
 * Set completion explicitly (used by command_center and goals).
 * Unlike toggleTaskForDate, this takes an explicit boolean.
 */
export async function setMindTaskCompletion(dateISO: string, taskId: string | number, completed: boolean): Promise<Completion | null> {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const numId = typeof taskId === "string" ? Number(taskId) : taskId;

  const existing = await db.completions
    .where("[taskId+dateKey]")
    .equals([numId, safeDate])
    .first();

  if (completed && !existing) {
    const id = await db.completions.add({ engine: "mind", taskId: numId, dateKey: safeDate });
    await ensureMindMeta(safeDate);
    return { id, engine: "mind", taskId: numId, dateKey: safeDate };
  }
  if (!completed && existing) {
    await db.completions.delete(existing.id!);
    return null;
  }
  return existing ?? null;
}

export function computeMindDayScoreFromLog(tasks: MindTask[], completedTaskIds: number[]) {
  const completedSet = new Set(completedTaskIds);
  const tasksWithCompletion = tasks.map((task) => ({
    ...task,
    completed: completedSet.has(task.id ?? -1),
  }));
  return computeBodyDayScore(tasksWithCompletion as Array<MindTask & { completed: boolean }>);
}

export async function computeMindDayScore(dateISO: string) {
  const log = await mindTaskLog.getLog(dateISO);
  const tasks = await mindTaskLog.listTasks();
  return computeMindDayScoreFromLog(tasks, log?.completedTaskIds ?? []);
}

export async function getMindScoreMapForRange(dateISO: string) {
  const safeDate = assertDateISO(dateISO ?? todayISO());
  const { start, end } = await import("./date").then((m) => m.monthBounds(safeDate));
  return mindTaskLog.getScoreMapForRange(start, end);
}

const mindTaskLog = createEngineTaskLogHelpers<MindTask, { id?: number; dateKey: string; completedTaskIds: number[]; createdAt: number }>({
  engine: "mind",
  computePercentFromLog: (tasks, completedTaskIds) => computeMindDayScoreFromLog(tasks, completedTaskIds).percent,
  onDateTouched: (dateKey) => touchEngineDate("mind", dateKey),
});
