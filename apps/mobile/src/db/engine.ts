import { getJSON, setJSON, nextId } from "./storage";
import type { EngineKey, Task } from "./schema";

// ─── Storage keys ──────────────────────────────────────────────────────────
// tasks:{engine} → Task[]
// completions:{engine}:{dateKey} → number[] (task IDs)

function tasksKey(engine: EngineKey): string {
  return `tasks:${engine}`;
}

function completionsKey(engine: EngineKey, dateKey: string): string {
  return `completions:${engine}:${dateKey}`;
}

// ─── Task CRUD ─────────────────────────────────────────────────────────────

export function listTasks(engine: EngineKey): Task[] {
  return getJSON<Task[]>(tasksKey(engine), []).filter((t) => t.is_active === 1);
}

export function addTask(
  engine: EngineKey,
  title: string,
  kind: "main" | "secondary",
  daysPerWeek = 7
): number {
  const id = nextId();
  const task: Task = {
    id,
    engine,
    title,
    kind,
    created_at: Date.now(),
    days_per_week: daysPerWeek,
    is_active: 1,
  };
  const tasks = getJSON<Task[]>(tasksKey(engine), []);
  tasks.push(task);
  setJSON(tasksKey(engine), tasks);
  return id;
}

export function updateTaskKind(taskId: number, kind: "main" | "secondary"): void {
  const engines: EngineKey[] = ["body", "mind", "money", "general"];
  for (const engine of engines) {
    const tasks = getJSON<Task[]>(tasksKey(engine), []);
    const idx = tasks.findIndex((t) => t.id === taskId);
    if (idx !== -1) {
      tasks[idx].kind = kind;
      setJSON(tasksKey(engine), tasks);
      return;
    }
  }
}

export function deleteTask(taskId: number): void {
  const engines: EngineKey[] = ["body", "mind", "money", "general"];
  for (const engine of engines) {
    const tasks = getJSON<Task[]>(tasksKey(engine), []);
    const filtered = tasks.filter((t) => t.id !== taskId);
    if (filtered.length !== tasks.length) {
      setJSON(tasksKey(engine), filtered);
      return;
    }
  }
}

// ─── Completions ───────────────────────────────────────────────────────────

export function getCompletedIds(engine: EngineKey, dateKey: string): Set<number> {
  const ids = getJSON<number[]>(completionsKey(engine, dateKey), []);
  return new Set(ids);
}

export function toggleTask(engine: EngineKey, taskId: number, dateKey: string): boolean {
  const key = completionsKey(engine, dateKey);
  const ids = getJSON<number[]>(key, []);
  const idx = ids.indexOf(taskId);

  if (idx !== -1) {
    ids.splice(idx, 1);
    setJSON(key, ids);
    return false; // uncompleted
  } else {
    ids.push(taskId);
    setJSON(key, ids);
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
  const engines: EngineKey[] = ["body", "mind", "money", "general"];
  const allTasks: TaskWithStatus[] = [];

  for (const engine of engines) {
    const tasks = listTasks(engine);
    const completedIds = getCompletedIds(engine, dateKey);
    for (const t of tasks) {
      allTasks.push({ ...t, completed: completedIds.has(t.id!) });
    }
  }

  return allTasks.sort((a, b) => {
    if (a.engine !== b.engine) return a.engine.localeCompare(b.engine);
    if (a.kind !== b.kind) return a.kind === "main" ? -1 : 1;
    return a.created_at - b.created_at;
  });
}
