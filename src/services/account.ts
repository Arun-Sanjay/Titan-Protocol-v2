import { supabase, requireUserId } from "../lib/supabase";
import { SYNCED_TABLES } from "../sync/tables";
import { run } from "../db/sqlite/client";

/**
 * Delete all user data — both cloud (Supabase) and local (SQLite).
 *
 *   1. Delete the profile row on Supabase. Every child table has
 *      `ON DELETE CASCADE` on the `user_id` foreign key, so the server
 *      wipes everything belonging to this user.
 *   2. Wipe the local SQLite tables so no stale data lingers after the
 *      next sign-in on this device.
 *   3. Sign out so the app returns to the login screen.
 */
export async function deleteAllUserData(): Promise<void> {
  const userId = await requireUserId();

  // Server-side cascade via profiles delete.
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", userId);
  if (error) throw error;

  // Local wipe so we don't upload stale rows on the next backup.
  for (const table of SYNCED_TABLES) {
    await run(`DELETE FROM ${table}`);
  }

  await supabase.auth.signOut();
}
