import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type UserTitle = Tables<"user_titles">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listUserTitles(): Promise<UserTitle[]> {
  const { data, error } = await supabase
    .from("user_titles")
    .select("*")
    .order("unlocked_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function equipTitle(titleId: string): Promise<void> {
  const userId = await requireUserId();

  // Unequip all first
  const { error: unequipErr } = await supabase
    .from("user_titles")
    .update({ equipped: false })
    .eq("user_id", userId);
  if (unequipErr) throw unequipErr;

  // Equip the selected title
  const { error: equipErr } = await supabase
    .from("user_titles")
    .update({ equipped: true })
    .eq("user_id", userId)
    .eq("title_id", titleId);
  if (equipErr) throw equipErr;
}

export async function unequipAllTitles(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("user_titles")
    .update({ equipped: false })
    .eq("user_id", userId);
  if (error) throw error;
}
