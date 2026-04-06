import { createEngineTaskLogHelpers, ensureEngineMeta, getEngineStartDate, touchEngineDate, type GeneralLog, type GeneralMeta, type GeneralTask } from "./db";
import { computeBodyDayScore } from "./bodyScore";

export async function ensureGeneralMeta(dateKey: string): Promise<GeneralMeta> {
  return ensureEngineMeta("general", dateKey);
}

export async function getGeneralStartDate(): Promise<string | null> {
  return getEngineStartDate("general");
}

export async function listGeneralTasks(): Promise<GeneralTask[]> {
  return generalTaskLog.listTasks();
}

export async function addGeneralTask(title: string, priority: "main" | "secondary", daysPerWeek = 7): Promise<number> {
  return generalTaskLog.addTask(title, priority, daysPerWeek);
}

export async function updateGeneralTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await generalTaskLog.updateTaskPriority(taskId, priority);
}

export async function renameGeneralTask(taskId: number, title: string): Promise<void> {
  await generalTaskLog.renameTask(taskId, title);
}

export async function deleteGeneralTask(taskId: number): Promise<void> {
  await generalTaskLog.deleteTask(taskId);
}

export async function getGeneralLog(dateKey: string): Promise<GeneralLog | undefined> {
  return generalTaskLog.getLog(dateKey);
}

export async function getOrCreateGeneralLog(dateKey: string): Promise<GeneralLog> {
  return generalTaskLog.getOrCreateLog(dateKey);
}

export async function toggleGeneralTaskForDate(dateKey: string, taskId: number): Promise<GeneralLog> {
  return generalTaskLog.toggleTaskForDate(dateKey, taskId);
}

export function computeGeneralDayScoreFromLog(tasks: GeneralTask[], completedTaskIds: number[]) {
  const completedSet = new Set(completedTaskIds);
  const tasksWithCompletion = tasks.map((task) => ({
    ...task,
    completed: completedSet.has(task.id ?? -1),
  }));
  return computeBodyDayScore(tasksWithCompletion as Array<GeneralTask & { completed: boolean }>);
}

export async function getGeneralScoreMapForRange(startKey: string, endKey: string): Promise<Record<string, number>> {
  return generalTaskLog.getScoreMapForRange(startKey, endKey);
}

const generalTaskLog = createEngineTaskLogHelpers<GeneralTask, GeneralLog>({
  engine: "general",
  computePercentFromLog: (tasks, completedTaskIds) => computeGeneralDayScoreFromLog(tasks, completedTaskIds).percent,
  onDateTouched: (dateKey) => touchEngineDate("general", dateKey),
});
