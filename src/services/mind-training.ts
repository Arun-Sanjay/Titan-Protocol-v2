import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type MindTrainingResult = Tables<"mind_training_results">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listMindTrainingResults(): Promise<MindTrainingResult[]> {
  return sqliteList<MindTrainingResult>("mind_training_results", {
    order: "answered_at DESC",
  });
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
  const row: MindTrainingResult = {
    id: newId(),
    user_id: userId,
    exercise_id: result.exerciseId,
    type: result.type,
    correct: result.correct,
    category: result.category ?? null,
    selected_option: result.selectedOption ?? null,
    time_spent_ms: result.timeSpentMs ?? null,
    answered_at: new Date().toISOString(),
  };
  return sqliteUpsert("mind_training_results", row);
}
