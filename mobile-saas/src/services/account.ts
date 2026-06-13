import { supabase } from "../lib/supabase";
import { SYNCED_TABLES } from "../sync/tables";
import { transaction } from "../db/sqlite/client";

/** Wipe every local user-data table in this app's SQLite database. */
export async function wipeAllLocalUserData(): Promise<void> {
  await transaction(async (tx) => {
    for (const table of SYNCED_TABLES) {
      await tx.runAsync(`DELETE FROM ${table}`);
    }
  });
}

/**
 * Permanently delete the signed-in user's account — server first, then
 * this device.
 *
 *   1. Invoke the `delete-account` Edge Function. It resolves the caller
 *      from the JWT and (with the service role) deletes the auth.users
 *      row; the FK graph cascades through profiles into every user-data
 *      table. A client-side `profiles` delete CANNOT work here:
 *      `profiles` has no DELETE RLS policy (so it silently affects zero
 *      rows) and the auth user would survive anyway.
 *   2. Wipe the local SQLite cache.
 *
 * The caller is responsible for the final `useAuthStore.signOut()` so
 * the device-local flags (onboarding MMKV, query cache) reset through
 * the one canonical sign-out path.
 */
export async function deleteAccount(): Promise<void> {
  const { data, error } = await supabase.functions.invoke("delete-account", {
    method: "POST",
  });
  if (error) {
    throw new Error(`[account] delete failed: ${error.message}`);
  }
  if (!(data as { deleted?: boolean } | null)?.deleted) {
    throw new Error("[account] delete failed: unexpected server response");
  }

  await wipeAllLocalUserData();
}
