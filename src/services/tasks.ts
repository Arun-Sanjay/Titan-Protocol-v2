import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteDelete,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables, Enums } from "../types/supabase";
import { toLocalDateKey } from "../lib/date";

// ─── Types ──────────────────────────────────────────────────────────────────

export type Task = Tables<"tasks">;
export type Completion = Tables<"completions">;
export type EngineKey = Enums<"engine_key">;
export type TaskKind = Enums<"task_kind">;

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// ─── Tasks ──────────────────────────────────────────────────────────────────

export async function listTasks(): Promise<Task[]> {
  return sqliteList<Task>("tasks", { order: "created_at ASC" });
}

export async function listTasksByEngine(engine: EngineKey): Promise<Task[]> {
  return sqliteList<Task>("tasks", {
    where: "engine = ?",
    params: [engine],
    order: "created_at ASC",
  });
}

export async function createTask(input: {
  title: string;
  engine: EngineKey;
  kind?: TaskKind;
  days_per_week?: number;
}): Promise<Task> {
  const userId = await requireUserId();
  const row: Task = {
    id: newId(),
    user_id: userId,
    title: input.title,
    engine: input.engine,
    kind: input.kind ?? "main",
    days_per_week: input.days_per_week ?? 7,
    is_active: true,
    legacy_local_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return sqliteUpsert("tasks", row);
}

export async function deleteTask(taskId: string): Promise<void> {
  await sqliteDelete("tasks", { id: taskId });
}

// ─── Completions ────────────────────────────────────────────────────────────

export async function listCompletionsForDate(
  dateKey: string,
): Promise<Completion[]> {
  return sqliteList<Completion>("completions", {
    where: "date_key = ?",
    params: [dateKey],
  });
}

export async function listCompletionsByEngine(
  engine: EngineKey,
  dateKey: string,
): Promise<Completion[]> {
  return sqliteList<Completion>("completions", {
    where: "engine = ? AND date_key = ?",
    params: [engine, dateKey],
  });
}

export async function listRecentCompletions(days: number): Promise<Completion[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = toLocalDateKey(since);
  return sqliteList<Completion>("completions", {
    where: "date_key >= ?",
    params: [sinceKey],
    order: "created_at DESC",
  });
}

/**
 * Toggle completion for a (task, dateKey) pair. Checks existing row,
 * soft-deletes if present, inserts if absent. Returns which direction
 * the toggle went.
 *
 * Local-first: both branches complete at SQLite-write latency (~1ms),
 * no await on network. The dashboard tap is now instant.
 */
export async function toggleCompletion(params: {
  taskId: string;
  dateKey: string;
  engine: EngineKey;
}): Promise<{ added: boolean }> {
  const [existing] = await sqliteList<Completion>("completions", {
    where: "task_id = ? AND date_key = ?",
    params: [params.taskId, params.dateKey],
    limit: 1,
  });
  if (existing) {
    await sqliteDelete("completions", { id: existing.id });
    return { added: false };
  }
  const userId = await requireUserId();
  await sqliteUpsert("completions", {
    id: newId(),
    user_id: userId,
    task_id: params.taskId,
    date_key: params.dateKey,
    engine: params.engine,
    created_at: new Date().toISOString(),
  });
  return { added: true };
}

// ─── Score Computation (pure) ──────────────────────────────────────────────

/**
 * Compute an engine's daily score (0-100) based on task completion.
 */
export function computeEngineScore(
  tasks: Task[],
  completions: Completion[] | Set<string>,
  engine?: EngineKey,
): number {
  const engineTasks = engine
    ? tasks.filter((t) => t.engine === engine && t.is_active)
    : tasks.filter((t) => t.is_active);
  if (engineTasks.length === 0) return 0;

  const completedIds =
    completions instanceof Set
      ? completions
      : new Set(completions.map((c) => c.task_id));
  const mainTasks = engineTasks.filter((t) => t.kind === "main");
  const sideTasks = engineTasks.filter((t) => t.kind === "secondary");

  const mainDone = mainTasks.filter((t) => completedIds.has(t.id)).length;
  const sideDone = sideTasks.filter((t) => completedIds.has(t.id)).length;

  const mainWeight = 0.7;
  const sideWeight = 0.3;

  const mainScore =
    mainTasks.length > 0 ? (mainDone / mainTasks.length) * 100 : 0;
  const sideScore =
    sideTasks.length > 0 ? (sideDone / sideTasks.length) * 100 : 0;

  if (mainTasks.length > 0 && sideTasks.length > 0) {
    return Math.round(mainScore * mainWeight + sideScore * sideWeight);
  }
  if (mainTasks.length > 0) return Math.round(mainScore);
  return Math.round(sideScore);
}
