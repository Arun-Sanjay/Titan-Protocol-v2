import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/supabase";

// ─── Lazy-initialized singleton ────────────────────────────────────────────
//
// Each platform calls initSupabase() once at startup (before React renders):
//   - Mobile: passes AsyncStorage for session persistence
//   - Web: passes nothing (defaults to localStorage)
//
// Services import { supabase } and use it after init.

export let supabase: SupabaseClient<Database>;

export type SupabaseInitOptions = {
  url: string;
  anonKey: string;
  /** Mobile: pass AsyncStorage. Web: omit (uses localStorage). */
  storage?: any;
  /** Mobile: false. Web: true (for OAuth redirects). */
  detectSessionInUrl?: boolean;
};

export function initSupabase(options: SupabaseInitOptions): SupabaseClient<Database> {
  supabase = createClient<Database>(options.url, options.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: options.detectSessionInUrl ?? true,
      ...(options.storage ? { storage: options.storage } : {}),
    },
  });
  return supabase;
}

/**
 * Returns the current auth user's ID or throws.
 * Use in service functions that require authentication.
 *
 * Uses getSession() (reads cached session from storage) instead of
 * getUser() (hits /auth/v1/user over the network). Network-backed
 * validation on every write made the app kick users back to login on
 * any transient failure, and added ~300ms latency to every mutation.
 */
export async function requireUserId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) throw new Error("Not authenticated");
  return session.user.id;
}

/**
 * Idempotently ensure a profiles row exists for the signed-in user.
 * The server-side handle_new_user trigger is the primary path, but this
 * client-side upsert is a belt-and-suspenders fallback so that an older
 * account (signed up before the trigger was installed) or a transient
 * trigger failure cannot leave the user with no profile row — without
 * which every FK-ed write (tasks, habits, journal_entries) fails 23503.
 */
export async function ensureProfileRow(
  userId: string,
  email: string | null,
): Promise<void> {
  await supabase
    .from("profiles")
    .upsert({ id: userId, email }, { onConflict: "id", ignoreDuplicates: true });
}
