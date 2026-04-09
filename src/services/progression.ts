/**
 * Phase 4: Progression / phase service.
 *
 * Singleton row per user. The phase advances through:
 *   foundation → building → intensify → sustain
 * The `phase_history` jsonb column stores the trail of past phases
 * with their stats.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate, Enums } from "../types/supabase";

export type ProgressionRow = Tables<"progression">;
export type ProgressionPhase = Enums<"progression_phase">;

export async function getProgression(): Promise<ProgressionRow | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("progression")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type UpsertProgressionInput = Omit<TablesInsert<"progression">, "user_id">;

export async function upsertProgression(
  input: UpsertProgressionInput,
): Promise<ProgressionRow> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("progression")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type AdvancePhaseInput = {
  newPhase: ProgressionPhase;
  newWeek: number;
  /** Stats payload to append to phase_history */
  stats?: Record<string, unknown>;
};

export async function advancePhase(
  input: AdvancePhaseInput,
): Promise<ProgressionRow> {
  const userId = await requireUserId();
  const current = await getProgression();
  // Append the OLD phase to history before transitioning.
  const history = Array.isArray(current?.phase_history)
    ? [...(current!.phase_history as Array<unknown>)]
    : [];
  if (current) {
    history.push({
      phase: current.current_phase,
      end_week: current.current_week,
      ended_at: new Date().toISOString(),
      stats: input.stats ?? {},
    });
  }
  const patch: TablesUpdate<"progression"> = {
    current_phase: input.newPhase,
    current_week: input.newWeek,
    phase_start_week: input.newWeek,
    phase_start_date: new Date().toISOString().slice(0, 10),
    phase_history: history as never,
  };
  const { data, error } = await supabase
    .from("progression")
    .update(patch)
    .eq("user_id", userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
