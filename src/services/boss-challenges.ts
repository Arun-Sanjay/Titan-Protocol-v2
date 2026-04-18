import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables, Enums } from "../types/supabase";
import type { Json } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type BossChallenge = Tables<"boss_challenges">;
export type BossStatus = Enums<"boss_status">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listActiveBossChallenges(): Promise<BossChallenge[]> {
  return sqliteList<BossChallenge>("boss_challenges", {
    where: "status = ?",
    params: ["active"],
    order: "started_at DESC",
  });
}

export async function startBossChallenge(boss: {
  boss_id: string;
  days_required: number;
  evaluator_type: string;
}): Promise<BossChallenge> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const row: BossChallenge = {
    id: newId(),
    user_id: userId,
    boss_id: boss.boss_id,
    days_required: boss.days_required,
    evaluator_type: boss.evaluator_type,
    status: "active" as BossStatus,
    progress: 0,
    day_results: [] as unknown as Json,
    resolved_at: null,
    started_at: now,
    updated_at: now,
  };
  return sqliteUpsert("boss_challenges", row);
}
