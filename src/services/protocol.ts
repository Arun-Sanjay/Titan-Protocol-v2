import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

export type ProtocolSession = Tables<"protocol_sessions">;

/**
 * Get the protocol session for a specific date.
 * Returns null if no session exists yet.
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
 * Save the morning protocol session.
 * Uses upsert on (user_id, date_key) — safe to call multiple times.
 */
export async function saveMorningSession(params: {
  dateKey: string;
  intention: string;
}): Promise<ProtocolSession> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from("protocol_sessions")
    .upsert(
      {
        user_id: userId,
        date_key: params.dateKey,
        morning_intention: params.intention,
        morning_completed_at: new Date().toISOString(),
      },
      { onConflict: "user_id,date_key" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Save the evening protocol session.
 * Merges into the existing row for today (morning must have been saved first,
 * but upsert handles the edge case where it wasn't).
 */
export async function saveEveningSession(params: {
  dateKey: string;
  reflection: string;
  titanScore?: number;
  identityVote?: string | null;
  habitChecks?: Json;
}): Promise<ProtocolSession> {
  const userId = await requireUserId();

  const payload: Record<string, unknown> = {
    user_id: userId,
    date_key: params.dateKey,
    evening_reflection: params.reflection,
    evening_completed_at: new Date().toISOString(),
  };
  if (params.titanScore !== undefined) payload.titan_score = params.titanScore;
  if (params.identityVote !== undefined)
    payload.identity_at_completion = params.identityVote;
  if (params.habitChecks !== undefined)
    payload.habit_checks = params.habitChecks;

  const { data, error } = await supabase
    .from("protocol_sessions")
    .upsert(payload, { onConflict: "user_id,date_key" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
