/**
 * Phase 4: Deep work sessions service.
 *
 * Flat list of sessions with started_at + ended_at + minutes. Category
 * is freeform text (e.g. "writing", "code review", "design"). Notes are
 * optional postmortem text.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

export type DeepWorkSession = Tables<"deep_work_sessions">;

export async function listDeepWorkSessions(rangeDays?: number): Promise<DeepWorkSession[]> {
  let query = supabase
    .from("deep_work_sessions")
    .select("*")
    .order("started_at", { ascending: false });

  if (rangeDays && rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    query = query.gte("date_key", cutoff.toISOString().slice(0, 10));
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type CreateDeepWorkInput = {
  dateKey: string;
  taskName: string;
  category?: string;
  minutes: number;
  startedAt?: string;
  endedAt?: string | null;
  notes?: string;
};

export async function createDeepWorkSession(
  input: CreateDeepWorkInput,
): Promise<DeepWorkSession> {
  const userId = await requireUserId();
  const row: TablesInsert<"deep_work_sessions"> = {
    user_id: userId,
    date_key: input.dateKey,
    task_name: input.taskName,
    category: input.category ?? null,
    minutes: input.minutes,
    started_at: input.startedAt ?? new Date().toISOString(),
    ended_at: input.endedAt ?? null,
    notes: input.notes ?? null,
  };
  const { data, error } = await supabase
    .from("deep_work_sessions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type UpdateDeepWorkInput = {
  id: string;
  patch: Pick<TablesUpdate<"deep_work_sessions">, "task_name" | "category" | "minutes" | "ended_at" | "notes">;
};

export async function updateDeepWorkSession(
  input: UpdateDeepWorkInput,
): Promise<DeepWorkSession> {
  const { data, error } = await supabase
    .from("deep_work_sessions")
    .update(input.patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteDeepWorkSession(id: string): Promise<void> {
  const { error } = await supabase
    .from("deep_work_sessions")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
