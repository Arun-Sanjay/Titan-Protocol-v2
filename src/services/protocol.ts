/**
 * Phase 3.3e: Protocol session service.
 *
 * The protocol_sessions table is a single row per (user, date_key)
 * holding both morning and evening session data. This fixes the
 * Phase 2.2A dual-write race from the old useProtocolStore — instead
 * of 6 separate MMKV keys that could be partially written, we now
 * upsert a single row atomically.
 *
 * Streak state lives on the profile (streak_current, streak_best,
 * streak_last_date) — it's cross-cutting and doesn't fit naturally on
 * a per-day protocol row.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, Enums } from "../types/supabase";

export type ProtocolSession = Tables<"protocol_sessions">;
export type Archetype = Enums<"archetype">;

// ─── Reads ──────────────────────────────────────────────────────────────────

/**
 * Fetch the protocol session for a specific date. Returns null if
 * the user hasn't started a session for that day.
 */
export async function getProtocolSession(
  dateKey: string,
): Promise<ProtocolSession | null> {
  const { data, error } = await supabase
    .from("protocol_sessions")
    .select("*")
    .eq("date_key", dateKey)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * List recent protocol sessions. Used by analytics + the weekly pulse
 * chart on the HQ dashboard.
 */
export async function listRecentProtocolSessions(
  limit: number = 30,
): Promise<ProtocolSession[]> {
  const { data, error } = await supabase
    .from("protocol_sessions")
    .select("*")
    .order("date_key", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/**
 * Save the morning protocol for today (or any date). Upserts on the
 * unique (user_id, date_key) constraint so re-saving just updates the
 * existing row.
 */
export async function saveMorningSession(
  dateKey: string,
  intention: string,
): Promise<ProtocolSession> {
  const userId = await requireUserId();
  const row: TablesInsert<"protocol_sessions"> = {
    user_id: userId,
    date_key: dateKey,
    morning_intention: intention,
    morning_completed_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("protocol_sessions")
    .upsert(row, { onConflict: "user_id,date_key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Save the evening protocol for today. Upserts the same row created
 * by saveMorningSession (if present) so morning + evening end up on
 * a single row per day. This is the entire fix for the Phase 2.2A
 * multi-key write race — there's nothing to be half-written.
 */
export async function saveEveningSession(params: {
  dateKey: string;
  reflection: string;
  titanScore: number;
  identityVote: Archetype | null;
  habitChecks?: Record<string, boolean>;
}): Promise<ProtocolSession> {
  const userId = await requireUserId();
  const row: TablesInsert<"protocol_sessions"> = {
    user_id: userId,
    date_key: params.dateKey,
    evening_reflection: params.reflection,
    evening_completed_at: new Date().toISOString(),
    titan_score: params.titanScore,
    identity_at_completion: params.identityVote,
    habit_checks: params.habitChecks ?? {},
  };

  const { data, error } = await supabase
    .from("protocol_sessions")
    .upsert(row, { onConflict: "user_id,date_key" })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Convenience selectors.
 */
export function isMorningDone(session: ProtocolSession | null): boolean {
  return Boolean(session?.morning_completed_at);
}

export function isEveningDone(session: ProtocolSession | null): boolean {
  return Boolean(session?.evening_completed_at);
}

export function isDayComplete(session: ProtocolSession | null): boolean {
  return isMorningDone(session) && isEveningDone(session);
}
