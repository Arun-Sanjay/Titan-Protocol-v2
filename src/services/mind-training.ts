/**
 * Phase 4: Mind training service.
 *
 * Two tables:
 *   - mind_training_results: append-only history of every exercise
 *     attempt (correct/incorrect, time spent)
 *   - srs_cards: spaced repetition card state per (user, exercise)
 *
 * The exercise content itself stays bundled in src/data/exercises/*.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

// ─── Results ────────────────────────────────────────────────────────────────

export type MindTrainingResult = Tables<"mind_training_results">;

export async function listMindTrainingResults(
  rangeDays?: number,
): Promise<MindTrainingResult[]> {
  let query = supabase
    .from("mind_training_results")
    .select("*")
    .order("answered_at", { ascending: false });

  if (rangeDays && rangeDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - rangeDays);
    query = query.gte("answered_at", cutoff.toISOString());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export type RecordResultInput = {
  exerciseId: string;
  type: string;
  category?: string;
  correct: boolean;
  selectedOption?: string;
  timeSpentMs?: number;
};

export async function recordMindResult(
  input: RecordResultInput,
): Promise<MindTrainingResult> {
  const userId = await requireUserId();
  const row: TablesInsert<"mind_training_results"> = {
    user_id: userId,
    exercise_id: input.exerciseId,
    type: input.type,
    category: input.category ?? null,
    correct: input.correct,
    selected_option: input.selectedOption ?? null,
    time_spent_ms: input.timeSpentMs ?? null,
  };
  const { data, error } = await supabase
    .from("mind_training_results")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── SRS cards ──────────────────────────────────────────────────────────────

export type SrsCard = Tables<"srs_cards">;

export async function listSrsCards(): Promise<SrsCard[]> {
  const { data, error } = await supabase
    .from("srs_cards")
    .select("*")
    .order("next_review_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listDueSrsCards(): Promise<SrsCard[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("srs_cards")
    .select("*")
    .lte("next_review_at", now)
    .order("next_review_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type UpsertSrsCardInput = {
  exerciseId: string;
  intervalDays?: number;
  easeFactor?: number;
  reviewCount?: number;
  nextReviewAt?: string;
};

export async function upsertSrsCard(input: UpsertSrsCardInput): Promise<SrsCard> {
  const userId = await requireUserId();
  const row: TablesInsert<"srs_cards"> = {
    user_id: userId,
    exercise_id: input.exerciseId,
    interval_days: input.intervalDays ?? 1,
    ease_factor: input.easeFactor ?? 2.5,
    review_count: input.reviewCount ?? 0,
    next_review_at: input.nextReviewAt ?? new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("srs_cards")
    .upsert(row, { onConflict: "user_id,exercise_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function reviewSrsCard(
  exerciseId: string,
  patch: Pick<TablesUpdate<"srs_cards">, "interval_days" | "ease_factor" | "review_count" | "next_review_at">,
): Promise<SrsCard> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("srs_cards")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("exercise_id", exerciseId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
