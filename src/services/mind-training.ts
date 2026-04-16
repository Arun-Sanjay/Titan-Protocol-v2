import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type MindTrainingResult = Tables<"mind_training_results">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listMindTrainingResults(): Promise<MindTrainingResult[]> {
  const { data, error } = await supabase
    .from("mind_training_results")
    .select("*")
    .order("answered_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function recordMindResult(result: {
  exerciseId: string;
  type: string;
  correct: boolean;
  category?: string;
  selectedOption?: string;
  timeSpentMs?: number;
}): Promise<MindTrainingResult> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("mind_training_results")
    .insert({
      user_id: userId,
      exercise_id: result.exerciseId,
      type: result.type,
      correct: result.correct,
      category: result.category ?? null,
      selected_option: result.selectedOption ?? null,
      time_spent_ms: result.timeSpentMs ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
