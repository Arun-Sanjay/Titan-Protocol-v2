import { supabase, requireUserId } from "../lib/supabase";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type FocusSession = Tables<"focus_sessions">;
export type FocusSettings = Tables<"focus_settings">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listFocusSessions(): Promise<FocusSession[]> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .order("started_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getFocusSettings(): Promise<FocusSettings | null> {
  const { data, error } = await supabase
    .from("focus_settings")
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertFocusSettings(
  settings: Partial<Omit<FocusSettings, "user_id" | "updated_at">>,
): Promise<FocusSettings> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("focus_settings")
    .upsert({
      user_id: userId,
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function recordFocusSession(session: {
  date_key: string;
  duration_minutes: number;
  completed?: boolean;
  category?: string;
}): Promise<FocusSession> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert({
      user_id: userId,
      date_key: session.date_key,
      duration_minutes: session.duration_minutes,
      completed: session.completed ?? true,
      category: session.category ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}
