/**
 * Phase 4: Achievements unlocked service.
 *
 * Each row is one user-achievement unlock event. The achievement
 * definitions themselves stay bundled in src/data/achievements.json —
 * the cloud table just stores which IDs are unlocked.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

export type AchievementUnlock = Tables<"achievements_unlocked">;

export async function listUnlockedAchievements(): Promise<AchievementUnlock[]> {
  const { data, error } = await supabase
    .from("achievements_unlocked")
    .select("*")
    .order("unlocked_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/**
 * Unlock a single achievement. Idempotent — if the row already exists
 * (same user + achievement_id), the upsert is a no-op.
 */
export async function unlockAchievement(achievementId: string): Promise<AchievementUnlock> {
  const userId = await requireUserId();
  const row: TablesInsert<"achievements_unlocked"> = {
    user_id: userId,
    achievement_id: achievementId,
  };
  const { data, error } = await supabase
    .from("achievements_unlocked")
    .upsert(row, { onConflict: "user_id,achievement_id", ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Bulk unlock — used by the Phase 1.5 achievement-checker after a
 * multi-pass evaluation. Idempotent on (user_id, achievement_id).
 */
export async function unlockAchievements(achievementIds: string[]): Promise<number> {
  if (achievementIds.length === 0) return 0;
  const userId = await requireUserId();
  const rows: TablesInsert<"achievements_unlocked">[] = achievementIds.map((id) => ({
    user_id: userId,
    achievement_id: id,
  }));
  const { error } = await supabase
    .from("achievements_unlocked")
    .upsert(rows, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
  if (error) throw error;
  return rows.length;
}
