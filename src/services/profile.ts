/**
 * Phase 3.3b: Profile service — Supabase read/write for the `profiles`
 * table.
 *
 * The service layer is a thin, typed wrapper around supabase-js. Every
 * function returns a Promise of the final data or throws a typed error.
 * React Query hooks in src/hooks/queries/ wrap these for caching +
 * optimistic updates.
 *
 * The service layer never touches MMKV directly — persistence is handled
 * by React Query's persister (Phase 3.3a).
 */

import { supabase } from "../lib/supabase";
import type { Tables, TablesUpdate, TablesInsert } from "../types/supabase";

export type Profile = Tables<"profiles">;
export type ProfileUpdate = TablesUpdate<"profiles">;
export type ProfileInsert = TablesInsert<"profiles">;

/**
 * Fetch the signed-in user's profile. Returns null if not signed in or
 * if the profile row doesn't exist yet (the on-auth trigger creates it
 * automatically, but there's a tiny race window right after sign-up).
 */
export async function getProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Update fields on the current user's profile. Returns the updated row.
 * RLS policy "profiles: update own" enforces that only the owner can
 * modify their row — even if a client passes a different id, it fails.
 */
export async function updateProfile(updates: ProfileUpdate): Promise<Profile> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Upsert a profile row. Mainly used during onboarding to bootstrap the
 * user profile (archetype, mode, first_use_date). For incremental updates
 * after that, use updateProfile.
 */
export async function upsertProfile(input: ProfileInsert): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(input)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Award XP to the current user. Reads the current profile, computes the
 * new xp + level, and writes back atomically.
 *
 * Level formula mirrors the Phase 2.1E useProfileStore logic: level =
 * floor(xp / XP_PER_LEVEL) + 1.
 *
 * Returns `{ profile, leveledUp, fromLevel, toLevel }` so the caller
 * can decide whether to enqueue a rank-up event.
 */
const XP_PER_LEVEL = 500;

export type AwardXPResult = {
  profile: Profile;
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
};

export async function awardXP(amount: number): Promise<AwardXPResult> {
  if (!Number.isFinite(amount)) {
    throw new Error(`Invalid XP amount: ${amount}`);
  }

  const current = await getProfile();
  if (!current) throw new Error("No profile found");

  const fromLevel = current.level;
  const newXp = Math.max(0, current.xp + amount);
  const toLevel = Math.max(1, Math.floor(newXp / XP_PER_LEVEL) + 1);

  const updated = await updateProfile({
    xp: newXp,
    level: toLevel,
  });

  return {
    profile: updated,
    leveledUp: toLevel > fromLevel && fromLevel >= 1,
    fromLevel,
    toLevel,
  };
}

/**
 * Mark onboarding as completed. The root layout uses this to gate the
 * onboarding flow (finishes the Phase 3.2 deferral).
 */
export async function completeOnboarding(
  partial?: Pick<ProfileUpdate, "archetype" | "display_name" | "mode" | "focus_engines" | "first_use_date">,
): Promise<Profile> {
  return updateProfile({
    onboarding_completed: true,
    ...partial,
  });
}

/**
 * Update streak. Called by the task-toggle mutation when the user
 * completes something on a day that advances their streak.
 *
 * Returns the updated profile.
 */
export async function updateStreak(dateKey: string): Promise<Profile> {
  const current = await getProfile();
  if (!current) throw new Error("No profile found");

  // Reuse the same computation as the old useProfileStore.updateStreak.
  // We're not using a Postgres function because the logic is trivial and
  // keeping it in TS means the Jest tests stay useful.
  const today = new Date(dateKey + "T00:00:00");
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;

  let newStreak: number;
  if (current.streak_last_date === yesterdayKey) {
    newStreak = current.streak_current + 1;
  } else if (current.streak_last_date === dateKey) {
    newStreak = current.streak_current;
  } else {
    newStreak = 1;
  }

  return updateProfile({
    streak_current: newStreak,
    streak_best: Math.max(newStreak, current.streak_best),
    streak_last_date: dateKey,
  });
}
