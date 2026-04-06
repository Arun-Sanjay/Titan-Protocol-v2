/**
 * Phase 3.3f: Rank-up events service.
 *
 * Replaces the MMKV `pending_rank_ups` queue from Phase 2.1E with a
 * proper `rank_up_events` table. The partial index on
 * (user_id, created_at) WHERE dismissed_at IS NULL makes the
 * "next undismissed" query cheap.
 *
 * Flow:
 *   1. src/services/profile.awardXP() detects a level-up and returns
 *      { leveledUp, fromLevel, toLevel }
 *   2. The caller (task completion mutation) calls enqueueRankUp() on
 *      level-ups
 *   3. The root layout subscribes to listPendingRankUps() — any
 *      undismissed row shows the LevelUpOverlay
 *   4. On dismiss, dismissRankUp(id) updates the row; the next
 *      undismissed row slides in
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

export type RankUpEvent = Tables<"rank_up_events">;

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * List all undismissed rank-up events for the current user, ordered
 * oldest first. The UI consumes them head-first.
 */
export async function listPendingRankUps(): Promise<RankUpEvent[]> {
  const { data, error } = await supabase
    .from("rank_up_events")
    .select("*")
    .is("dismissed_at", null)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// ─── Writes ─────────────────────────────────────────────────────────────────

export type EnqueueRankUpInput = {
  fromLevel: number;
  toLevel: number;
};

export async function enqueueRankUp(
  input: EnqueueRankUpInput,
): Promise<RankUpEvent> {
  const userId = await requireUserId();
  const row: TablesInsert<"rank_up_events"> = {
    user_id: userId,
    from_level: input.fromLevel,
    to_level: input.toLevel,
  };
  const { data, error } = await supabase
    .from("rank_up_events")
    .insert(row)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Mark a rank-up event as dismissed. Does NOT delete the row so we
 * can analyze celebration engagement later (in Phase 4.4 PostHog).
 */
export async function dismissRankUp(eventId: string): Promise<void> {
  const { error } = await supabase
    .from("rank_up_events")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", eventId);

  if (error) throw error;
}
