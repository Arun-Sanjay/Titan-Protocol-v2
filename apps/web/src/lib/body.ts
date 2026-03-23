import { createEngineTaskLogHelpers, ensureEngineMeta, getEngineStartDate, touchEngineDate, type BodyLog, type BodyMeta, type BodyTask } from "./db";
import { computeBodyDayScore } from "./bodyScore";

export async function ensureBodyMeta(todayKey: string): Promise<BodyMeta> {
  return ensureEngineMeta("body", todayKey);
}

export async function getBodyStartDate(): Promise<string | null> {
  return getEngineStartDate("body");
}

export async function listBodyTasks(): Promise<BodyTask[]> {
  return bodyTaskLog.listTasks();
}

export async function addBodyTask(
  title: string,
  priority: "main" | "secondary",
  daysPerWeek = 7,
): Promise<number> {
  return bodyTaskLog.addTask(title, priority, daysPerWeek);
}

export async function updateBodyTaskPriority(taskId: number, priority: "main" | "secondary"): Promise<void> {
  await bodyTaskLog.updateTaskPriority(taskId, priority);
}

export async function renameBodyTask(taskId: number, title: string): Promise<void> {
  await bodyTaskLog.renameTask(taskId, title);
}

export async function deleteBodyTask(taskId: number): Promise<void> {
  await bodyTaskLog.deleteTask(taskId);
}

export async function getBodyLog(dateKey: string): Promise<BodyLog | undefined> {
  return bodyTaskLog.getLog(dateKey);
}

export async function getOrCreateBodyLog(dateKey: string): Promise<BodyLog> {
  return bodyTaskLog.getOrCreateLog(dateKey);
}

export async function toggleBodyTaskForDate(dateKey: string, taskId: number): Promise<BodyLog> {
  return bodyTaskLog.toggleTaskForDate(dateKey, taskId);
}

export function computeBodyDayScoreFromLog(tasks: BodyTask[], completedTaskIds: number[]) {
  const completedSet = new Set(completedTaskIds);
  const tasksWithCompletion = tasks.map((task) => ({
    ...task,
    completed: completedSet.has(task.id ?? -1),
  }));
  return computeBodyDayScore(tasksWithCompletion as Array<BodyTask & { completed: boolean }>);
}

export async function getBodyScoreMapForRange(
  startKey: string,
  endKey: string,
): Promise<Record<string, number>> {
  return bodyTaskLog.getScoreMapForRange(startKey, endKey);
}

const bodyTaskLog = createEngineTaskLogHelpers<BodyTask, BodyLog>({
  engine: "body",
  computePercentFromLog: (tasks, completedTaskIds) => computeBodyDayScoreFromLog(tasks, completedTaskIds).percent,
  onDateTouched: (dateKey) => touchEngineDate("body", dateKey),
});
