import { requireUserId } from "../lib/session";
import {
  sqliteGet,
  cloudGet,
  cloudUpsert,
} from "../db/sqlite/service-helpers";
import type { Tables } from "@titan/shared/types/supabase";

export type Profile = Tables<"profiles">;

export async function getProfile(): Promise<Profile | null> {
  const userId = await requireUserId();
  return sqliteGet<Profile>("profiles", { id: userId });
}

/**
 * Merge-update the profile row. Read existing → apply partial → write.
 *
 * The base row comes from the local cache, falling back to the cloud row
 * on a cache miss (fresh browser before the first-run pull, or after a
 * failed pull) — the Supabase `handle_new_user` trigger guarantees a row
 * exists for every account. Never merges onto an invented default: that
 * used to push a zeroed profile (xp 0 / level 1 / streak 0) over an
 * existing user's cloud row, and Realtime then spread the wipe to every
 * other signed-in device.
 */
export async function upsertProfile(
  updates: Partial<Omit<Profile, "id" | "created_at">>,
): Promise<Profile> {
  const userId = await requireUserId();
  const existing =
    (await sqliteGet<Profile>("profiles", { id: userId })) ??
    (await cloudGet<Profile>("profiles", { id: userId }));
  if (!existing) {
    throw new Error(
      "[profile] no profile row in cache or cloud — refusing to write defaults",
    );
  }
  const merged: Profile = { ...existing, ...updates };
  return cloudUpsert("profiles", merged);
}
