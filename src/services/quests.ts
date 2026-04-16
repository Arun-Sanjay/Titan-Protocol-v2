import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";
import type { Quest as QuestUI } from "../types/quest-ui";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type Quest = Tables<"quests">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listActiveQuests(): Promise<Quest[]> {
  const { data, error } = await supabase
    .from("quests")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

/**
 * Persist generated weekly quests to Supabase. Skips if there are
 * already active quests for this user (idempotent).
 */
export async function insertWeeklyQuests(quests: QuestUI[]): Promise<void> {
  if (quests.length === 0) return;
  const userId = await requireUserId();
  const today = new Date().toISOString().slice(0, 10);
  const rows = quests.map((q) => ({
    user_id: userId,
    week_start_key: today,
    type: q.type,
    title: q.title,
    description: q.description,
    target: q.targetValue,
    progress: q.currentValue,
    status: "active" as const,
    xp_reward: q.xpReward,
    metadata: {
      type: q.type,
      targetType: q.targetType,
      targetEngine: q.targetEngine ?? null,
      templateId: q.templateId ?? null,
    },
  }));
  const { error } = await supabase.from("quests").insert(rows);
  if (error) throw error;
}
