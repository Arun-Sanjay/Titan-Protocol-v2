import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Phase 0: Supabase client with AsyncStorage session persistence.
 *
 * Session tokens are stored in AsyncStorage so the user stays signed in
 * across app restarts. Auto-refresh is enabled to silently renew tokens.
 */
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

/**
 * Returns the current auth user's ID or throws.
 * Use in service functions that require authentication.
 *
 * Uses getSession() (reads cached session from AsyncStorage) instead of
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
