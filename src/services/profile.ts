import { requireUserId } from "../lib/supabase";
import {
  sqliteGet,
  sqliteUpsert,
  transaction,
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
 *
 * Wrapped in a SQLite transaction so the read-modify-write is atomic
 * relative to other profile writes. Without this, two concurrent
 * `upsertProfile` calls (e.g. awarding XP for a task + a streak update
 * fired in the same tick) would both read the same `existing`, both
 * compute their own merged row, and the second write would clobber the
 * first — losing one of the updates.
 */
export async function upsertProfile(
  updates: Partial<Omit<Profile, "id" | "created_at">>,
): Promise<Profile> {
  const userId = await requireUserId();
  return transaction(async () => {
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    const base: Profile = existing ?? defaultProfile(userId);
    const merged: Profile = { ...base, ...updates };
    return sqliteUpsert("profiles", merged);
  });
}

/**
 * Atomic XP delta + level recalculation. Reads, mutates, and writes the
 * profile row inside one SQLite transaction so concurrent awards never
 * lose XP or miss a rank-up event.
 *
 * Level formula matches `useAwardXP`: `level = floor(xp / 500) + 1`.
 */
export async function awardXP(xpDelta: number): Promise<{
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
  xp: number;
}> {
  const userId = await requireUserId();
  return transaction(async () => {
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    const base: Profile = existing ?? defaultProfile(userId);
    const oldXP = base.xp ?? 0;
    const oldLevel = base.level ?? 1;
    const newXP = Math.max(0, oldXP + xpDelta);
    const newLevel = Math.floor(newXP / 500) + 1;
    await sqliteUpsert("profiles", { ...base, xp: newXP, level: newLevel });
    return {
      leveledUp: newLevel > oldLevel,
      fromLevel: oldLevel,
      toLevel: newLevel,
      xp: newXP,
    };
  });
}

/**
 * Atomic streak update. Same rationale as `awardXP` — without the tx,
 * a streak update concurrent with an XP award would race the read and
 * lose one of the writes.
 */
export async function updateStreak(
  dateKey: string,
): Promise<{ newStreak: number }> {
  const userId = await requireUserId();
  return transaction(async () => {
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    const base: Profile = existing ?? defaultProfile(userId);
    const lastDate = base.streak_last_date ?? null;
    let newStreak = base.streak_current ?? 0;

    if (lastDate !== dateKey) {
      const last = new Date(lastDate ?? "1970-01-01");
      const current = new Date(dateKey);
      const diffDays = Math.round(
        (current.getTime() - last.getTime()) / 86_400_000,
      );
      newStreak = diffDays === 1 ? newStreak + 1 : 1;
    }

    const newBest = Math.max(newStreak, base.streak_best ?? 0);
    await sqliteUpsert("profiles", {
      ...base,
      streak_current: newStreak,
      streak_best: newBest,
      streak_last_date: dateKey,
    });
    return { newStreak };
  });
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
    expo_push_token: null,
    created_at: now,
    updated_at: now,
  };
}
