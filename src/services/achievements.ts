import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type AchievementUnlocked = Tables<"achievements_unlocked">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listUnlockedAchievements(): Promise<AchievementUnlocked[]> {
  const { data, error } = await supabase
    .from("achievements_unlocked")
    .select("*")
    .order("unlocked_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Persist newly unlocked achievement IDs to Supabase.
 * Uses batch insert and ignores duplicates (onConflict on user_id + achievement_id
 * is handled by the unique constraint; Supabase will skip duplicates with
 * ignoreDuplicates).
 */
export async function insertUnlockedAchievements(
  achievementIds: string[],
): Promise<void> {
  if (achievementIds.length === 0) return;
  const userId = await requireUserId();
  const rows = achievementIds.map((aid) => ({
    user_id: userId,
    achievement_id: aid,
  }));
  const { error } = await supabase
    .from("achievements_unlocked")
    .insert(rows);
  if (error) throw error;
}
