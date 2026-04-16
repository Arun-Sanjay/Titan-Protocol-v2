import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

export type RankUpEvent = Tables<"rank_up_events">;

/**
 * List undismissed rank-up events, oldest first.
 * Uses the partial index `rank_ups_user_undismissed_idx` on (user_id, created_at)
 * WHERE dismissed_at IS NULL.
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

/**
 * Enqueue a rank-up event (fires when awardXP detects a level change).
 */
export async function enqueueRankUp(params: {
  fromLevel: number;
  toLevel: number;
}): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase.from("rank_up_events").insert({
    user_id: userId,
    from_level: params.fromLevel,
    to_level: params.toLevel,
  });
  if (error) throw error;
}

/**
 * Soft-dismiss a rank-up event by setting dismissed_at.
 * Does NOT delete — preserves the event for analytics/history.
 */
export async function dismissRankUp(eventId: string): Promise<void> {
  const { error } = await supabase
    .from("rank_up_events")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", eventId);
  if (error) throw error;
}
