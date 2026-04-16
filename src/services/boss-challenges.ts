import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, Enums } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type BossChallenge = Tables<"boss_challenges">;
export type BossStatus = Enums<"boss_status">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listActiveBossChallenges(): Promise<BossChallenge[]> {
  const { data, error } = await supabase
    .from("boss_challenges")
    .select("*")
    .eq("status", "active")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function startBossChallenge(boss: {
  boss_id: string;
  days_required: number;
  evaluator_type: string;
}): Promise<BossChallenge> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("boss_challenges")
    .insert({
      user_id: userId,
      boss_id: boss.boss_id,
      days_required: boss.days_required,
      evaluator_type: boss.evaluator_type,
      status: "active" as BossStatus,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
