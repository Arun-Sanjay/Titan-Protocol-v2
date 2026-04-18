import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type RankUpEvent = Tables<"rank_up_events">;

/** Undismissed rank-up events, oldest first. */
export async function listPendingRankUps(): Promise<RankUpEvent[]> {
  return sqliteList<RankUpEvent>("rank_up_events", {
    where: "dismissed_at IS NULL",
    order: "created_at ASC",
  });
}

/** Enqueue a rank-up event (fires when awardXP detects a level change). */
export async function enqueueRankUp(params: {
  fromLevel: number;
  toLevel: number;
}): Promise<void> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  await sqliteUpsert("rank_up_events", {
    id: newId(),
    user_id: userId,
    from_level: params.fromLevel,
    to_level: params.toLevel,
    dismissed_at: null,
    created_at: now,
  });
}

/** Soft-dismiss a rank-up event by stamping dismissed_at. */
export async function dismissRankUp(eventId: string): Promise<void> {
  const existing = await sqliteGet<RankUpEvent>("rank_up_events", {
    id: eventId,
  });
  if (!existing) return;
  await sqliteUpsert("rank_up_events", {
    ...existing,
    dismissed_at: new Date().toISOString(),
  });
}
