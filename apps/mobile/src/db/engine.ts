import { db } from "./database";
import type { EngineKey, Task } from "./schema";

// ─── Task CRUD ─────────────────────────────────────────────────────────────

export function listTasks(engine: EngineKey): Task[] {
  return db.getAllSync<Task>(
    "SELECT * FROM tasks WHERE engine = ? AND is_active = 1 ORDER BY kind ASC, created_at ASC",
    [engine]
  );
}

export function addTask(
  engine: EngineKey,
  title: string,
  kind: "main" | "secondary",
  daysPerWeek = 7
): number {
  const result = db.runSync(
    "INSERT INTO tasks (engine, title, kind, created_at, days_per_week, is_active) VALUES (?, ?, ?, ?, ?, 1)",
    [engine, title, kind, Date.now(), daysPerWeek]
  );
  return result.lastInsertRowId;
}

export function updateTaskKind(taskId: number, kind: "main" | "secondary"): void {
  db.runSync("UPDATE tasks SET kind = ? WHERE id = ?", [kind, taskId]);
}

export function deleteTask(taskId: number): void {
  db.runSync("DELETE FROM tasks WHERE id = ?", [taskId]);
  db.runSync("DELETE FROM completions WHERE task_id = ?", [taskId]);
}

// ─── Completions ───────────────────────────────────────────────────────────

export function getCompletedIds(engine: EngineKey, dateKey: string): Set<number> {
  const rows = db.getAllSync<{ task_id: number }>(
    "SELECT task_id FROM completions WHERE engine = ? AND date_key = ?",
    [engine, dateKey]
  );
  return new Set(rows.map((r) => r.task_id));
}

export function toggleTask(engine: EngineKey, taskId: number, dateKey: string): boolean {
  const existing = db.getFirstSync<{ id: number }>(
    "SELECT id FROM completions WHERE task_id = ? AND date_key = ?",
    [taskId, dateKey]
  );

  if (existing) {
    db.runSync("DELETE FROM completions WHERE id = ?", [existing.id]);
    return false; // uncompleted
  } else {
    db.runSync(
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

export function getEngineScore(engine: EngineKey, dateKey: string): number {
  const tasks = listTasks(engine);
  const completedIds = getCompletedIds(engine, dateKey);
  return computeScore(tasks, completedIds);
}

export function getAllEngineScores(dateKey: string): Record<EngineKey, number> {
  return {
    body: getEngineScore("body", dateKey),
    mind: getEngineScore("mind", dateKey),
    money: getEngineScore("money", dateKey),
    general: getEngineScore("general", dateKey),
  };
}

export function getTotalScore(dateKey: string): number {
  const scores = getAllEngineScores(dateKey);
  const values = Object.values(scores);
  if (values.every((s) => s === 0)) return 0;
  return Math.round(values.reduce((a, b) => a + b, 0) / 4);
}

// ─── All tasks for a date (dashboard) ──────────────────────────────────────

export type TaskWithStatus = Task & { completed: boolean };

export function getAllTasksForDate(dateKey: string): TaskWithStatus[] {
  const tasks = db.getAllSync<Task>(
    "SELECT * FROM tasks WHERE is_active = 1 ORDER BY engine ASC, kind ASC, created_at ASC"
  );
  const completions = db.getAllSync<{ task_id: number }>(
    "SELECT task_id FROM completions WHERE date_key = ?",
    [dateKey]
  );
  const completedSet = new Set(completions.map((c) => c.task_id));
  return tasks.map((t) => ({ ...t, completed: completedSet.has(t.id!) }));
}
