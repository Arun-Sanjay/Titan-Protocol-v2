import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type DeepWorkSession = Tables<"deep_work_sessions">;
export type DeepWorkTask = Tables<"deep_work_tasks">;
export type DeepWorkLog = Tables<"deep_work_logs">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listDeepWorkSessions(): Promise<DeepWorkSession[]> {
  const { data, error } = await supabase
    .from("deep_work_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createDeepWorkSession(session: {
  task_name: string;
  date_key: string;
  minutes: number;
  category?: string;
  notes?: string;
}): Promise<DeepWorkSession> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("deep_work_sessions")
    .insert({
      user_id: userId,
      task_name: session.task_name,
      date_key: session.date_key,
      minutes: session.minutes,
      category: session.category ?? null,
      notes: session.notes ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDeepWorkSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("deep_work_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

// ─── Deep Work Tasks (daily recurring categories) ──────────────────────────

export async function listDeepWorkTasks(): Promise<DeepWorkTask[]> {
  const { data, error } = await supabase
    .from("deep_work_tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createDeepWorkTask(task: {
  task_name: string;
  category: string;
}): Promise<DeepWorkTask> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("deep_work_tasks")
    .insert({
      user_id: userId,
      task_name: task.task_name,
      category: task.category,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDeepWorkTask(taskId: string): Promise<void> {
  // Cascades to deep_work_logs via FK on delete cascade.
  const { error } = await supabase
    .from("deep_work_tasks")
    .delete()
    .eq("id", taskId);
  if (error) throw error;
}

// ─── Deep Work Logs ────────────────────────────────────────────────────────

export async function listDeepWorkLogs(): Promise<DeepWorkLog[]> {
  const { data, error } = await supabase
    .from("deep_work_logs")
    .select("*")
    .order("date_key", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertDeepWorkLog(log: {
  task_id: string;
  date_key: string;
  completed: boolean;
  earnings_today: number;
}): Promise<DeepWorkLog> {
  const userId = await requireUserId();
  const { data: existing } = await supabase
    .from("deep_work_logs")
    .select("id")
    .eq("task_id", log.task_id)
    .eq("date_key", log.date_key)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("deep_work_logs")
      .update({
        completed: log.completed,
        earnings_today: log.earnings_today,
      })
      .eq("id", existing.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from("deep_work_logs")
    .insert({
      user_id: userId,
      task_id: log.task_id,
      date_key: log.date_key,
      completed: log.completed,
      earnings_today: log.earnings_today,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
