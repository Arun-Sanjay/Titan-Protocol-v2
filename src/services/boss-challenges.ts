/**
 * Phase 4: Boss challenges service.
 *
 * Multi-day challenges where the user must hit a daily condition for
 * N consecutive days. Active state lives in `boss_challenges` with
 * status='active'; on success/failure the row gets resolved.
 *
 * Phase 4 unique constraint allows a user to re-attempt a previously
 * failed boss by updating the existing row.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate, Enums, Json } from "../types/supabase";

export type BossChallenge = Tables<"boss_challenges">;
export type BossStatus = Enums<"boss_status">;

export async function listActiveBossChallenges(): Promise<BossChallenge[]> {
  const { data, error } = await supabase
    .from("boss_challenges")
    .select("*")
    .eq("status", "active")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBossChallenge(bossId: string): Promise<BossChallenge | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("boss_challenges")
    .select("*")
    .eq("user_id", userId)
    .eq("boss_id", bossId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type StartBossInput = {
  bossId: string;
  daysRequired: number;
  evaluatorType: string;
};

export async function startBossChallenge(
  input: StartBossInput,
): Promise<BossChallenge> {
  const userId = await requireUserId();
  const row: TablesInsert<"boss_challenges"> = {
    user_id: userId,
    boss_id: input.bossId,
    days_required: input.daysRequired,
    evaluator_type: input.evaluatorType,
    progress: 0,
    day_results: [] as unknown as Json,
    status: "active",
    started_at: new Date().toISOString(),
    resolved_at: null,
  };
  const { data, error } = await supabase
    .from("boss_challenges")
    .upsert(row, { onConflict: "user_id,boss_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export type RecordBossDayInput = {
  id: string;
  /** Whether the day's condition was met. */
  passed: boolean;
};

/**
 * Append a day result and bump progress. The caller decides when to
 * call resolveBossChallenge based on progress vs days_required.
 */
export async function recordBossDay(
  input: RecordBossDayInput,
): Promise<BossChallenge> {
  // Read current row to append to day_results jsonb.
  const { data: current, error: getError } = await supabase
    .from("boss_challenges")
    .select("*")
    .eq("id", input.id)
    .single();
  if (getError) throw getError;
  if (!current) throw new Error(`Boss challenge ${input.id} not found`);

  const dayResults = Array.isArray(current.day_results)
    ? [...(current.day_results as Array<unknown>), input.passed]
    : [input.passed];
  const progress = dayResults.filter(Boolean).length;

  const patch: TablesUpdate<"boss_challenges"> = {
    day_results: dayResults as never,
    progress,
  };

  const { data, error } = await supabase
    .from("boss_challenges")
    .update(patch)
    .eq("id", input.id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function resolveBossChallenge(
  id: string,
  status: "defeated" | "failed" | "abandoned",
): Promise<BossChallenge> {
  const patch: TablesUpdate<"boss_challenges"> = {
    status,
    resolved_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from("boss_challenges")
    .update(patch)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
