import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { useAuthStore } from "../stores/useAuthStore";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Supabase client. AsyncStorage-persisted session, auto-refresh ON
 * (the background ticker handles token rotation; it is NOT called per
 * request).
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
 * Return the signed-in user's id, or throw. Called from every service
 * write (`createTask`, `toggleCompletion`, etc.) to scope the `user_id`
 * column.
 *
 * Reads from the in-memory auth store — a plain JS object populated
 * once at boot by `useAuthStore.initialize()`. Zero network, zero
 * AsyncStorage I/O, zero supabase-js lock contention. A tight burst of
 * taps (20 completions in a second) is now purely SQLite writes.
 *
 * Why this matters: earlier versions called `supabase.auth.getSession()`
 * here, which internally checks the 90 s expiry margin and triggers a
 * token refresh whenever the access token is close to expiring. Any
 * quick sequence of writes could fire 20+ parallel refreshes, land on
 * a /token 429, and get treated as a terminal auth failure —
 * `SIGNED_OUT` fired, user kicked to login mid-tap. Reading from the
 * store short-circuits that whole machinery; token refresh still
 * happens, but only on supabase-js's own background ticker, not per
 * user action.
 *
 * The signature stays async so existing call sites don't change shape.
 */
export async function requireUserId(): Promise<string> {
  const userId = useAuthStore.getState().user?.id;
  if (!userId) throw new Error("Not authenticated");
  return userId;
}

// NOTE: the old `ensureProfileRow` helper (which did a direct
// `supabase.from('profiles').upsert(...)` on every SIGNED_IN) was
// removed during the local-first migration. The auth store now calls
// the profile service's `upsertProfile` which writes to SQLite only;
// the row goes up to Supabase on the next manual backup.
