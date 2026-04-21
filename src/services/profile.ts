import { requireUserId } from "../lib/supabase";
import {
  sqliteGet,
  sqliteUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Profile = Tables<"profiles">;

export async function getProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  return sqliteGet<Profile>("profiles", { id: userId });
}

/**
 * Merge-update the profile row. Read existing → apply partial → write. If
 * no row exists yet, start from a defaulted base (matches the Supabase
 * `handle_new_user` trigger's output plus JS-typed values).
 */
export async function upsertProfile(
  updates: Partial<Omit<Profile, "id" | "created_at">>,
): Promise<Profile> {
  const userId = await requireUserId();
  const existing = await sqliteGet<Profile>("profiles", { id: userId });
  const base: Profile = existing ?? defaultProfile(userId);
  const merged: Profile = { ...base, ...updates };
  return sqliteUpsert("profiles", merged);
}

function defaultProfile(userId: string): Profile {
  const now = new Date().toISOString();
  return {
    id: userId,
    email: null,
    display_name: null,
    archetype: null,
    level: 1,
    xp: 0,
    streak_current: 0,
    streak_best: 0,
    streak_last_date: null,
    mode: "full_protocol",
    focus_engines: [],
    onboarding_completed: false,
    tutorial_completed: false,
    first_use_date: null,
    first_task_completed_at: null,
    created_at: now,
    updated_at: now,
  };
}
