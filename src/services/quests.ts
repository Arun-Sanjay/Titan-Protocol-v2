import { supabase } from "../lib/supabase";
import type { Tables } from "../types/supabase";

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
