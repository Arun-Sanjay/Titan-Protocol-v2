import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type DeepWorkSession = Tables<"deep_work_sessions">;

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
