import { supabase } from "../lib/supabase";

/**
 * Delete all user data from Supabase.
 * RLS ensures we can only delete our own rows.
 * The profiles table has ON DELETE CASCADE, so deleting the profile
 * removes all related rows in other tables.
 */
export async function deleteAllUserData(): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Delete the profile — CASCADE handles the rest
  const { error } = await supabase
    .from("profiles")
    .delete()
    .eq("id", user.id);
  if (error) throw error;

  // Sign out locally
  await supabase.auth.signOut();
}
