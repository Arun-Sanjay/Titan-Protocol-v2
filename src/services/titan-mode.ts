import { supabase } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type TitanModeState = Tables<"titan_mode_state">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function getTitanModeState(): Promise<TitanModeState | null> {
  const { data, error } = await supabase
    .from("titan_mode_state")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}
