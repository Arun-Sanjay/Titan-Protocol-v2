import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

export type Profile = Tables<"profiles">;

export async function getProfile(): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .single();
  if (error) {
    if (error.code === "PGRST116") return null; // no row
    throw error;
  }
  return data;
}

export async function upsertProfile(
  updates: Partial<Omit<Profile, "id" | "created_at">>,
): Promise<Profile> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...updates })
    .select()
    .single();
  if (error) throw error;
  return data;
}
