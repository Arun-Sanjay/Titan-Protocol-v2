/**
 * Platform init — call once before React renders.
 *
 * Initializes the shared Supabase client with web-appropriate defaults:
 *   - localStorage for session persistence (Supabase default on web)
 *   - detectSessionInUrl: true (for OAuth redirect handling)
 */
import { initSupabase } from "@titan/shared/lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment",
  );
}

initSupabase({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  detectSessionInUrl: true,
  // PKCE: OAuth + password-recovery codes land in the query string
  // (?code=…), which coexists with HashRouter — the implicit flow's
  // #access_token fragment collided with our #/ routes and never parsed.
  flowType: "pkce",
});
