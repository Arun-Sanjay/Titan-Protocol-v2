import { requireUserId } from "../lib/supabase";
import {
  newId,
  sqliteGet,
  sqliteList,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

// ─── Re-exported Types ─────────────────────────────────────────────────────

export type FocusSession = Tables<"focus_sessions">;
export type FocusSettings = Tables<"focus_settings">;

// ─── Service Functions ─────────────────────────────────────────────────────

export async function listFocusSessions(): Promise<FocusSession[]> {
  return sqliteList<FocusSession>("focus_sessions", {
    order: "started_at DESC",
  });
}

export async function getFocusSettings(): Promise<FocusSettings | null> {
  const userId = await requireUserId();
  return sqliteGet<FocusSettings>("focus_settings", { user_id: userId });
}

export async function upsertFocusSettings(
  settings: Partial<Omit<FocusSettings, "user_id" | "updated_at">>,
): Promise<FocusSettings> {
  const userId = await requireUserId();
  const now = new Date().toISOString();
  const existing = await sqliteGet<FocusSettings>("focus_settings", {
    user_id: userId,
  });

  const base: FocusSettings = existing ?? {
    user_id: userId,
    pomodoro_minutes: 25,
    break_minutes: 5,
    long_break_minutes: 15,
    long_break_after: 4,
    daily_target_sessions: 4,
    sound_enabled: true,
    updated_at: now,
  };

  const merged: FocusSettings = {
    ...base,
    ...settings,
    user_id: userId,
    updated_at: now,
  };
  return sqliteUpsert("focus_settings", merged);
}

export async function recordFocusSession(session: {
  date_key: string;
  duration_minutes: number;
  completed?: boolean;
  category?: string;
}): Promise<FocusSession> {
  const userId = await requireUserId();
  const row: FocusSession = {
    id: newId(),
    user_id: userId,
    date_key: session.date_key,
    duration_minutes: session.duration_minutes,
    completed: session.completed ?? true,
    category: session.category ?? null,
    started_at: new Date().toISOString(),
    ended_at: null,
  };
  return sqliteUpsert("focus_sessions", row);
}
