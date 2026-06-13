import { supabase } from "../lib/session";
import { SYNCED_TABLES } from "../sync/tables";
import { run } from "../db/sqlite/client";

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
 *   3. Clear the local session (the server-side user is already gone).
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

  for (const table of SYNCED_TABLES) {
    await run(`DELETE FROM ${table}`);
  }

  await supabase.auth.signOut();
}
