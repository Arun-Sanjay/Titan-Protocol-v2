import { requireUserId } from "../lib/supabase";
import {
  sqliteGet,
  cloudGet,
  cloudUpsert,
  transaction,
} from "../db/sqlite/service-helpers";
import type { Tables } from "../types/supabase";

export type Profile = Tables<"profiles">;

export async function getProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  return sqliteGet<Profile>("profiles", { id: userId });
}

/**
 * Make sure the canonical profile row is present in the local cache.
 * Cache first; on a miss (fresh device, before the first-run pull has
 * seeded SQLite) fall back to the cloud row — the Supabase
 * `handle_new_user` trigger guarantees one exists for every account, and
 * `cloudGet` mirrors it into SQLite so the transactional read below
 * finds it.
 *
 * Throws when neither side has the row: merging onto an invented default
 * is what used to push a zeroed profile (xp 0 / level 1 / streak 0 /
 * display_name null) over an existing user's cloud row when onboarding
 * ran on a new device, and Realtime then spread the wipe to every other
 * signed-in device.
 */
async function ensureProfileBase(userId: string): Promise<void> {
  const cached = await sqliteGet<Profile>("profiles", { id: userId });
  if (cached) return;
  const cloud = await cloudGet<Profile>("profiles", { id: userId });
  if (cloud) return;
  throw new Error(
    "[profile] no profile row in cache or cloud — refusing to write defaults",
  );
}

/**
 * Merge-update the profile row. Read existing → apply partial → write.
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
  // The network fallback runs BEFORE the transaction — never inside it.
  await ensureProfileBase(userId);
  return transaction(async () => {
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    if (!existing) {
      throw new Error("[profile] profile row missing mid-write");
    }
    const merged: Profile = { ...existing, ...updates };
    return cloudUpsert("profiles", merged);
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
  await ensureProfileBase(userId);
  return transaction(async () => {
    const existing = await sqliteGet<Profile>("profiles", { id: userId });
    if (!existing) {
      throw new Error("[profile] profile row missing mid-write");
    }
    const oldXP = existing.xp ?? 0;
    const oldLevel = existing.level ?? 1;
    const newXP = Math.max(0, oldXP + xpDelta);
    const newLevel = Math.floor(newXP / 500) + 1;
    await cloudUpsert("profiles", { ...existing, xp: newXP, level: newLevel });
    return {
      leveledUp: newLevel > oldLevel,
      fromLevel: oldLevel,
      toLevel: newLevel,
      xp: newXP,
    };
  });
}
