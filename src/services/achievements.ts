import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteUpsertMany,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type AchievementUnlocked = Tables<"achievements_unlocked">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listUnlockedAchievements(): Promise<AchievementUnlocked[]> {
  return sqliteList<AchievementUnlocked>("achievements_unlocked", {
    order: "unlocked_at DESC",
  });
}

/**
 * Persist newly unlocked achievement IDs. Skips any achievement ID the
 * user already has — the old Supabase call relied on a uniqueness
 * constraint on (user_id, achievement_id) to dedupe; we mimic that
 * behaviour client-side before enqueueing the inserts.
 */
export async function insertUnlockedAchievements(
  achievementIds: string[],
): Promise<void> {
  if (achievementIds.length === 0) return;
  const userId = await requireUserId();

  const existing = await sqliteList<AchievementUnlocked>(
    "achievements_unlocked",
    {},
  );
  const existingIds = new Set(existing.map((a) => a.achievement_id));
  const now = new Date().toISOString();

  const rows: AchievementUnlocked[] = achievementIds
    .filter((aid) => !existingIds.has(aid))
    .map((aid) => ({
      id: newId(),
      user_id: userId,
      achievement_id: aid,
      unlocked_at: now,
    }));

  if (rows.length === 0) return;
  await sqliteUpsertMany("achievements_unlocked", rows);
}
