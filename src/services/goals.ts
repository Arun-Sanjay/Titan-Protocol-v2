import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Goal = Tables<"goals">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listGoals(): Promise<Goal[]> {
  const { data, error } = await supabase
    .from("goals")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGoal(goal: {
  title: string;
  target_date?: string;
  status?: string;
}): Promise<Goal> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      title: goal.title,
      target_date: goal.target_date ?? null,
      status: goal.status ?? "active",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteGoal(goalId: string): Promise<void> {
  const { error } = await supabase.from("goals").delete().eq("id", goalId);
  if (error) throw error;
}
