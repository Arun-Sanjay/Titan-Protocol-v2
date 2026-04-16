import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";
import type { Json } from "../types/supabase";

export type Progression = Tables<"progression">;

/**
 * Get the progression row for the current user.
 * Returns null if no row exists yet (new user before first phase check).
 */
export async function getProgression(): Promise<Progression | null> {
  const { data, error } = await supabase
    .from("progression")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Upsert the progression row.
 * PK is user_id — one row per user.
 */
export async function upsertProgression(params: {
  current_phase?: string;
  current_week?: number;
  phase_start_week?: number;
  first_use_date?: string;
  phase_start_date?: string;
  phase_history?: Json;
}): Promise<Progression> {
  const userId = await requireUserId();

  const payload: Record<string, unknown> = { user_id: userId };
  if (params.current_phase !== undefined)
    payload.current_phase = params.current_phase;
  if (params.current_week !== undefined)
    payload.current_week = params.current_week;
  if (params.phase_start_week !== undefined)
    payload.phase_start_week = params.phase_start_week;
  if (params.first_use_date !== undefined)
    payload.first_use_date = params.first_use_date;
  if (params.phase_start_date !== undefined)
    payload.phase_start_date = params.phase_start_date;
  if (params.phase_history !== undefined)
    payload.phase_history = params.phase_history;

  const { data, error } = await supabase
    .from("progression")
    .upsert(payload, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
