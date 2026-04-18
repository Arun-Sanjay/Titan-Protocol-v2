import { supabase } from "../lib/supabase";
import { resetLocalDataForUserSwitch } from "../sync/seed";

/**
 * Delete all user data. Local-first strategy:
 *   1. Delete the profile row on Supabase — the `profiles` table has
 *      ON DELETE CASCADE on every child table, so the server wipes
 *      every row belonging to this user.
 *   2. Clear the local SQLite database so stale rows don't linger after
 *      sign-out and no push loop tries to upsert them back.
 *   3. Sign out so the next launch lands on the login screen and fresh
 *      onboarding.
 */
export async function deleteAllUserData(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Server-side cascade via profiles delete
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", user.id);
  if (error) throw error;

  // Local wipe mirrors the server cascade so there's no stale data left
  // behind for the next signed-in user on this device.
  await resetLocalDataForUserSwitch();

  // Sign out locally
  await supabase.auth.signOut();
}
