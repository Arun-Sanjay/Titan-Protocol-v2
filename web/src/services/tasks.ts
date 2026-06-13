import { requireUserId } from "../lib/session";
import {
  newId,
  cloudDelete,
  sqliteList,
  sqliteGet,
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

/** Edit an existing task in place (rename / change kind / change days-per-week)
 *  without losing its id or completion history — the premium alternative to
 *  delete-and-recreate (audit §5.5). */
export async function updateTask(
  taskId: string,
  patch: { title?: string; kind?: TaskKind; days_per_week?: number },
): Promise<Task> {
  const existing = await sqliteGet<Task>("tasks", { id: taskId });
  if (!existing) throw new Error(`[tasks] cannot update missing task ${taskId}`);
  return cloudUpsert("tasks", {
    ...existing,
    title: patch.title ?? existing.title,
    kind: patch.kind ?? existing.kind,
    days_per_week: patch.days_per_week ?? existing.days_per_week,
    updated_at: new Date().toISOString(),
  });
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
 * Per-(task, date) toggle serialization. Two rapid clicks on the same
 * checkbox used to race the check-then-insert: both read "no completion",
 * both inserted, and the second insert hit the server's UNIQUE
 * (task_id, date_key) — leaving a poison `_dirty=1` row behind. Chaining
 * the second toggle behind the first turns a double-click into
 * insert-then-delete, which is what the user meant. Mirrors the
 * transaction guard mobile-saas added for the same race.
 */
const togglesInFlight = new Map<string, Promise<{ added: boolean }>>();

/**
 * Toggle completion for a (task, dateKey) pair. Checks existing row,
 * deletes if present, inserts if absent. Returns which direction the
 * toggle went. Cloud-first via cloudUpsert/cloudDelete.
 */
export async function toggleCompletion(params: {
  taskId: string;
  dateKey: string;
  engine: EngineKey;
}): Promise<{ added: boolean }> {
  const key = `${params.taskId}:${params.dateKey}`;
  const prev = togglesInFlight.get(key) ?? Promise.resolve();
  const next = (prev as Promise<unknown>)
    // A failed predecessor must not poison the chain.
    .catch(() => undefined)
    .then(() => toggleCompletionInner(params));
  togglesInFlight.set(key, next);
  try {
    return await next;
  } finally {
    if (togglesInFlight.get(key) === next) togglesInFlight.delete(key);
  }
}

async function toggleCompletionInner(params: {
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
