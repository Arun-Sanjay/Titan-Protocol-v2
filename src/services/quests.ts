import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteUpsertMany,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";
import type { Quest as QuestUI } from "../types/quest-ui";
import type { Json } from "../types/supabase";
import { getTodayKey } from "../lib/date";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Quest = Tables<"quests">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listActiveQuests(): Promise<Quest[]> {
  return sqliteList<Quest>("quests", {
    where: "status = ?",
    params: ["active"],
    order: "created_at DESC",
  });
}

/**
 * Persist generated weekly quests. Mirrors the old Supabase behaviour:
 * caller decides idempotency (the old code left dedupe to the UI layer).
 */
export async function insertWeeklyQuests(quests: QuestUI[]): Promise<void> {
  if (quests.length === 0) return;
  const userId = await requireUserId();
  const today = getTodayKey();
  const now = new Date().toISOString();

  const rows: Quest[] = quests.map((q) => ({
    id: newId(),
    user_id: userId,
    week_start_key: today,
    type: q.type,
    title: q.title,
    description: q.description,
    target: q.targetValue,
    progress: q.currentValue,
    status: "active" as Quest["status"],
    xp_reward: q.xpReward,
    metadata: {
      type: q.type,
      targetType: q.targetType,
      targetEngine: q.targetEngine ?? null,
      templateId: q.templateId ?? null,
    } as Json,
    created_at: now,
    expires_at: null,
    updated_at: now,
  }));

  await sqliteUpsertMany("quests", rows);
}
