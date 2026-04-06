/**
 * Phase 3.3c: Tasks + completions service.
 *
 * Typed Supabase wrappers for the `tasks` and `completions` tables.
 * Tasks are user-defined templates per engine; completions are the
 * per-day toggles against each task.
 *
 * The scoring logic (main=2pt, secondary=1pt, % of total) lives in
 * src/lib/scoring-v2.ts (Phase 2.4F has 27 tests pinning this
 * behavior). Services just fetch and write; hooks compose.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type {
  Tables,
  TablesInsert,
  Enums,
} from "../types/supabase";

export type Task = Tables<"tasks">;
export type Completion = Tables<"completions">;
export type EngineKey = Enums<"engine_key">;
export type TaskKind = Enums<"task_kind">;

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * List all active tasks for a given engine.
 * RLS enforces user_id = auth.uid(), so no explicit user filter needed.
 */
export async function listTasks(engine: EngineKey): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("engine", engine)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * List all tasks across every engine. Used by the dashboard for the
 * "today's missions" section.
 */
export async function listAllTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("is_active", true)
    .order("engine", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/**
 * List completions for a specific (engine, dateKey). Returns the raw
 * completion rows — the caller derives the completed Set<taskId> by
 * mapping over `.task_id`.
 */
export async function listCompletions(
  engine: EngineKey,
  dateKey: string,
): Promise<Completion[]> {
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .eq("engine", engine)
    .eq("date_key", dateKey);

  if (error) throw error;
  return data ?? [];
}

/**
 * List all completions for a single day across all engines. Used by
 * the HQ dashboard to show "N of M tasks completed" across the whole
 * protocol without 4 separate queries.
 */
export async function listAllCompletionsForDate(
  dateKey: string,
): Promise<Completion[]> {
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .eq("date_key", dateKey);

  if (error) throw error;
  return data ?? [];
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export type CreateTaskInput = {
  engine: EngineKey;
  title: string;
  kind: TaskKind;
  daysPerWeek?: number;
};

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const userId = await requireUserId();
  const row: TablesInsert<"tasks"> = {
    user_id: userId,
    engine: input.engine,
    title: input.title,
    kind: input.kind,
    days_per_week: input.daysPerWeek ?? 7,
    is_active: true,
  };
  const { data, error } = await supabase
    .from("tasks")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  // Soft delete: mark is_active = false instead of deleting the row.
  // Preserves historical completion data for analytics.
  const { error } = await supabase
    .from("tasks")
    .update({ is_active: false })
    .eq("id", taskId);

  if (error) throw error;
}

/**
 * Toggle a completion for (taskId, dateKey). Deletes if exists, inserts
 * if not. Returns the new state `{ completed: boolean }`.
 */
export async function toggleCompletion(
  task: Pick<Task, "id" | "engine">,
  dateKey: string,
): Promise<{ completed: boolean }> {
  const userId = await requireUserId();

  // Check current state.
  const { data: existing, error: existingError } = await supabase
    .from("completions")
    .select("id")
    .eq("task_id", task.id)
    .eq("date_key", dateKey)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing) {
    // Un-complete: delete the row.
    const { error } = await supabase
      .from("completions")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return { completed: false };
  }

  // Complete: insert a row.
  const row: TablesInsert<"completions"> = {
    user_id: userId,
    task_id: task.id,
    engine: task.engine,
    date_key: dateKey,
  };
  const { error } = await supabase.from("completions").insert(row);
  if (error) throw error;
  return { completed: true };
}

// ─── Derived helpers ────────────────────────────────────────────────────────

/**
 * Compute the score for an engine's tasks against a set of completed
 * task IDs. Mirrors the Phase 2.1 scoring logic — main=2pt, secondary=1pt,
 * % of total possible. 27 Jest tests in src/__tests__/scoring.test.ts
 * pin the weighted-titan-score variant; the per-engine version here is
 * the building block those scores are averaged from.
 */
export function computeEngineScore(
  tasks: Task[],
  completedTaskIds: Set<string>,
): number {
  if (tasks.length === 0) return 0;
  let earned = 0;
  let total = 0;
  for (const t of tasks) {
    const pts = t.kind === "main" ? 2 : 1;
    total += pts;
    if (completedTaskIds.has(t.id)) earned += pts;
  }
  return total === 0 ? 0 : Math.round((earned / total) * 100);
}
