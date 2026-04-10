/**
 * Wave 0: Goals service.
 *
 * Personal goals with title, optional target date, and status.
 * Replaces useGoalStore's MMKV-backed goal list.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

export type Goal = Tables<"goals">;

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listActiveGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type CreateGoalInput = {
  title: string;
  targetDate?: string;
};

export async function createGoal(input: CreateGoalInput): Promise<Goal> {
  const userId = await requireUserId();
  const row: TablesInsert<"goals"> = {
    user_id: userId,
    title: input.title,
    target_date: input.targetDate ?? null,
    status: "active",
  };
  const { data, error } = await supabase
    .from("goals")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateGoal(
  id: string,
  patch: Pick<TablesUpdate<"goals">, "title" | "target_date" | "status">,
): Promise<Goal> {
  const { data, error } = await supabase
    .from("goals")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", id);
  if (error) throw error;
}

export async function completeGoal(id: string): Promise<Goal> {
  return updateGoal(id, { status: "completed" });
}
