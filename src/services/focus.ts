/**
 * Phase 4: Focus engine service.
 *
 * Two tables:
 *   - focus_settings: singleton per user (pomodoro lengths, daily
 *     target sessions, sound preference)
 *   - focus_sessions: per-day pomodoro session log
 */

import { supabase, requireUserId } from "../lib/supabase";
import type { Tables, TablesInsert, TablesUpdate } from "../types/supabase";

// ─── Settings ───────────────────────────────────────────────────────────────

export type FocusSettings = Tables<"focus_settings">;

export async function getFocusSettings(): Promise<FocusSettings | null> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("focus_settings")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export type UpsertFocusSettingsInput = Omit<TablesInsert<"focus_settings">, "user_id">;

export async function upsertFocusSettings(
  input: UpsertFocusSettingsInput,
): Promise<FocusSettings> {
  const userId = await requireUserId();
  const { data, error } = await supabase
    .from("focus_settings")
    .upsert({ user_id: userId, ...input }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Sessions ───────────────────────────────────────────────────────────────

export type FocusSession = Tables<"focus_sessions">;

export async function listFocusSessions(dateKey: string): Promise<FocusSession[]> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .eq("date_key", dateKey)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function listFocusSessionsForRange(
  startDateKey: string,
  endDateKey: string,
): Promise<FocusSession[]> {
  const { data, error } = await supabase
    .from("focus_sessions")
    .select("*")
    .gte("date_key", startDateKey)
    .lte("date_key", endDateKey)
    .order("date_key", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export type RecordFocusSessionInput = {
  dateKey: string;
  durationMinutes: number;
  category?: string;
  completed?: boolean;
  startedAt?: string;
  endedAt?: string;
};

export async function recordFocusSession(
  input: RecordFocusSessionInput,
): Promise<FocusSession> {
  const userId = await requireUserId();
  const row: TablesInsert<"focus_sessions"> = {
    user_id: userId,
    date_key: input.dateKey,
    duration_minutes: input.durationMinutes,
    category: input.category ?? null,
    completed: input.completed ?? true,
    started_at: input.startedAt ?? new Date().toISOString(),
    ended_at: input.endedAt ?? null,
  };
  const { data, error } = await supabase
    .from("focus_sessions")
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFocusSession(id: string): Promise<void> {
  const { error } = await supabase.from("focus_sessions").delete().eq("id", id);
  if (error) throw error;
}
