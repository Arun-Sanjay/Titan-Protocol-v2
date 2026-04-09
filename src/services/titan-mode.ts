/**
 * Phase 4: Titan Mode service.
 *
 * Singleton row per user. Tracks the rolling 30-day window of high-
 * scoring days that unlocks the titan mode flag. The recordDay()
 * helper is the main write path — it computes the new consecutive
 * day count and decides whether to set unlocked=true.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";
import { addDays, getTodayKey } from "../lib/date";

export type TitanModeState = Tables<"titan_mode_state">;

const TITAN_UNLOCK_DAYS = 30;
const TITAN_UNLOCK_THRESHOLD_SCORE = 85;

export async function getTitanModeState(): Promise<TitanModeState | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("titan_mode_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type UpsertTitanModeInput = Omit<TablesInsert<"titan_mode_state">, "user_id">;

export async function upsertTitanModeState(
  input: UpsertTitanModeInput,
): Promise<TitanModeState> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("titan_mode_state")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Record a day's titan score against the rolling 30-day window. Bumps
 * consecutive_days if the score is above threshold AND yesterday was
 * recorded; otherwise resets. Sets unlocked=true once consecutive_days
 * hits TITAN_UNLOCK_DAYS.
 */
export async function recordDay(titanScore: number): Promise<TitanModeState> {
  const userId = await requireUserId();
  const today = getTodayKey();
  const yesterday = addDays(today, -1);
  const current = await getTitanModeState();

  const meetsThreshold = titanScore >= TITAN_UNLOCK_THRESHOLD_SCORE;

  let consecutiveDays = current?.consecutive_days ?? 0;
  let startDate = current?.start_date ?? null;
  let averageScore = current?.average_score ?? 0;

  if (current?.last_recorded_date === today) {
    // Already recorded today — return as-is.
    return current;
  }

  if (meetsThreshold) {
    if (current?.last_recorded_date === yesterday) {
      consecutiveDays += 1;
      // Running average: ((avg * (n-1)) + new) / n
      averageScore = Math.round(
        ((averageScore * (consecutiveDays - 1)) + titanScore) / consecutiveDays,
      );
    } else {
      // New streak.
      consecutiveDays = 1;
      averageScore = titanScore;
      startDate = today;
    }
  } else {
    // Below threshold — reset.
    consecutiveDays = 0;
    averageScore = 0;
    startDate = null;
  }

  const unlocked = (current?.unlocked ?? false) || consecutiveDays >= TITAN_UNLOCK_DAYS;

  const patch: TablesUpdate<"titan_mode_state"> = {
    unlocked,
    consecutive_days: consecutiveDays,
    average_score: averageScore,
    start_date: startDate,
    last_recorded_date: today,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("titan_mode_state")
    .upsert({ user_id: userId, ...patch }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
