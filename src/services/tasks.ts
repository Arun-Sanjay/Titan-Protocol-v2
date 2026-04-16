import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, Enums } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Task = Tables<"tasks">;
export type Completion = Tables<"completions">;
export type EngineKey = Enums<"engine_key">;
export type TaskKind = Enums<"task_kind">;

// ─── Constants ─────────────────────────────────────────────────────────────

export const ENGINES: EngineKey[] = ["body", "mind", "money", "charisma"];

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listTasksByEngine(engine: EngineKey): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("engine", engine)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createTask(task: {
  title: string;
  engine: EngineKey;
  kind?: TaskKind;
  days_per_week?: number;
}): Promise<Task> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      title: task.title,
      engine: task.engine,
      kind: task.kind ?? "main",
      days_per_week: task.days_per_week ?? 7,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

// ─── Completions ───────────────────────────────────────────────────────────

export async function listCompletionsForDate(
  dateKey: string,
): Promise<Completion[]> {
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .eq("date_key", dateKey);
  if (error) throw error;
  return data ?? [];
}

export async function listCompletionsByEngine(
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

export async function listRecentCompletions(days: number): Promise<Completion[]> {
  // Fetch completions for the last N days
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceKey = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("completions")
    .select("*")
    .gte("date_key", sinceKey)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function toggleCompletion(params: {
  taskId: string;
  dateKey: string;
  engine: EngineKey;
}): Promise<{ added: boolean }> {
  const userId = await requireUserId();

  // Check if completion already exists
  const { data: existing, error: checkErr } = await supabase
    .from("completions")
    .select("id")
    .eq("task_id", params.taskId)
    .eq("date_key", params.dateKey)
    .maybeSingle();
  if (checkErr) throw checkErr;

  if (existing) {
    // Remove completion
    const { error } = await supabase
      .from("completions")
      .delete()
      .eq("id", existing.id);
    if (error) throw error;
    return { added: false };
  } else {
    // Add completion
    const { error } = await supabase.from("completions").insert({
      user_id: userId,
      task_id: params.taskId,
      date_key: params.dateKey,
      engine: params.engine,
    });
    if (error) throw error;
    return { added: true };
  }
}

// ─── Score Computation (pure) ──────────────────────────────────────────────

/**
 * Compute an engine's daily score (0-100) based on task completion.
 * When `engine` is omitted the caller has already pre-filtered the
 * tasks list, so we skip the engine filter and just check `is_active`.
 * `completions` also accepts a Set<string> of completed task IDs for
 * screens that pre-compute the set.
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
