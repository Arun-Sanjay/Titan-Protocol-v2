import { requireUserId } from "../lib/session";
import {
  newId,
  cloudDelete,
  sqliteList,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import { addDaysISO, todayISO } from "../lib/date";
import type { Tables, Enums } from "@titan/shared/types/supabase";

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
  return cloudUpsert("tasks", row);
}

export async function deleteTask(taskId: string): Promise<void> {
  await cloudDelete("tasks", { id: taskId });
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
  const sinceKey = addDaysISO(todayISO(), -days);
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
    await cloudDelete("completions", { id: existing.id });
    return { added: false };
  }
  const userId = await requireUserId();
  await cloudUpsert("completions", {
    id: newId(),
    user_id: userId,
    task_id: params.taskId,
    date_key: params.dateKey,
    engine: params.engine,
    created_at: new Date().toISOString(),
  });
  return { added: true };
}
