import { getDB } from "./database";
import type { EngineKey, Task, Completion } from "./schema";

// ─── Task CRUD ─────────────────────────────────────────────────────────────

export async function listTasks(engine: EngineKey): Promise<Task[]> {
  const db = await getDB();
  return db.getAllAsync<Task>(
    "SELECT * FROM tasks WHERE engine = ? AND is_active = 1 ORDER BY kind ASC, created_at ASC",
    [engine]
  );
}

export async function addTask(
  engine: EngineKey,
  title: string,
  kind: "main" | "secondary",
  daysPerWeek = 7
): Promise<number> {
  const db = await getDB();
  const result = await db.runAsync(
    "INSERT INTO tasks (engine, title, kind, created_at, days_per_week, is_active) VALUES (?, ?, ?, ?, ?, 1)",
    [engine, title, kind, Date.now(), daysPerWeek]
  );
  return result.lastInsertRowId;
}

export async function updateTaskKind(taskId: number, kind: "main" | "secondary"): Promise<void> {
  const db = await getDB();
  await db.runAsync("UPDATE tasks SET kind = ? WHERE id = ?", [kind, taskId]);
}

export async function deleteTask(taskId: number): Promise<void> {
  const db = await getDB();
  await db.runAsync("DELETE FROM tasks WHERE id = ?", [taskId]);
  await db.runAsync("DELETE FROM completions WHERE task_id = ?", [taskId]);
}

// ─── Completions ───────────────────────────────────────────────────────────

export async function getCompletedIds(engine: EngineKey, dateKey: string): Promise<Set<number>> {
  const db = await getDB();
  const rows = await db.getAllAsync<{ task_id: number }>(
    "SELECT task_id FROM completions WHERE engine = ? AND date_key = ?",
    [engine, dateKey]
  );
  return new Set(rows.map((r) => r.task_id));
}

export async function toggleTask(engine: EngineKey, taskId: number, dateKey: string): Promise<boolean> {
  const db = await getDB();
  const existing = await db.getFirstAsync<{ id: number }>(
    "SELECT id FROM completions WHERE task_id = ? AND date_key = ?",
    [taskId, dateKey]
  );

  if (existing) {
    await db.runAsync("DELETE FROM completions WHERE id = ?", [existing.id]);
    return false; // uncompleted
  } else {
    await db.runAsync(
      "INSERT INTO completions (engine, task_id, date_key) VALUES (?, ?, ?)",
      [engine, taskId, dateKey]
    );
    return true; // completed
  }
}

// ─── Scoring ───────────────────────────────────────────────────────────────

export function computeScore(tasks: Task[], completedIds: Set<number>): number {
  if (tasks.length === 0) return 0;
  let earned = 0;
  let total = 0;
  for (const t of tasks) {
    const pts = t.kind === "main" ? 2 : 1;
    total += pts;
    if (completedIds.has(t.id!)) earned += pts;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}

export async function getEngineScore(engine: EngineKey, dateKey: string): Promise<number> {
  const [tasks, completedIds] = await Promise.all([
    listTasks(engine),
    getCompletedIds(engine, dateKey),
  ]);
  return computeScore(tasks, completedIds);
}

export async function getAllEngineScores(dateKey: string): Promise<Record<EngineKey, number>> {
  const engines: EngineKey[] = ["body", "mind", "money", "general"];
  const scores = await Promise.all(engines.map((e) => getEngineScore(e, dateKey)));
  return {
    body: scores[0],
    mind: scores[1],
    money: scores[2],
    general: scores[3],
  };
}

export async function getTotalScore(dateKey: string): Promise<number> {
  const scores = await getAllEngineScores(dateKey);
  const values = Object.values(scores);
  const activeEngines = values.filter((s) => s > 0);
  if (activeEngines.length === 0) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / 4);
}

// ─── All tasks for a date (dashboard) ──────────────────────────────────────

export type TaskWithStatus = Task & { completed: boolean };

export async function getAllTasksForDate(dateKey: string): Promise<TaskWithStatus[]> {
  const db = await getDB();
  const tasks = await db.getAllAsync<Task>(
    "SELECT * FROM tasks WHERE is_active = 1 ORDER BY engine ASC, kind ASC, created_at ASC"
  );
  const completions = await db.getAllAsync<{ task_id: number }>(
    "SELECT task_id FROM completions WHERE date_key = ?",
    [dateKey]
  );
  const completedSet = new Set(completions.map((c) => c.task_id));
  return tasks.map((t) => ({ ...t, completed: completedSet.has(t.id!) }));
}
