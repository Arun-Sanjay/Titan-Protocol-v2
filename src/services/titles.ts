/**
 * Phase 4: User titles service.
 *
 * One row per (user, title_id). The `equipped` flag is mutually
 * exclusive within a user — equipping one title automatically
 * un-equips any others. Title definitions stay bundled in
 * src/data/titles.json.
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert } from "../types/supabase";

export type UserTitle = Tables<"user_titles">;

export async function listUserTitles(): Promise<UserTitle[]> {
  const { data, error } = await supabase
    .from("user_titles")
    .select("*")
    .order("unlocked_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getEquippedTitle(): Promise<UserTitle | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("user_titles")
    .select("*")
    .eq("user_id", userId)
    .eq("equipped", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function unlockTitle(titleId: string): Promise<UserTitle> {
  const userId = await requireUserId();
  const row: TablesInsert<"user_titles"> = {
    user_id: userId,
    title_id: titleId,
  };
  const { data, error } = await supabase
    .from("user_titles")
    .upsert(row, { onConflict: "user_id,title_id", ignoreDuplicates: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Equip a title and un-equip any others. Done as two queries because
 * Postgres doesn't have a clean "set X to true and Y to false" pattern
 * via supabase-js without a stored procedure.
 */
export async function equipTitle(titleId: string): Promise<UserTitle> {
  const userId = await requireUserId();

  // Un-equip everything else.
  const { error: clearError } = await supabase
    .from("user_titles")
    .update({ equipped: false })
    .eq("user_id", userId)
    .neq("title_id", titleId);
  if (clearError) throw clearError;

  // Equip the target.
  const { data, error } = await supabase
    .from("user_titles")
    .update({ equipped: true })
    .eq("user_id", userId)
    .eq("title_id", titleId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function unequipAllTitles(): Promise<void> {
  const userId = await requireUserId();
  const { error } = await supabase
    .from("user_titles")
    .update({ equipped: false })
    .eq("user_id", userId);
  if (error) throw error;
}
