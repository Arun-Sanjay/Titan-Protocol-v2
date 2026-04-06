/**
 * Phase 3.2: Supabase client.
 *
 * One global, typed Supabase client for the entire app. Uses AsyncStorage
 * for session persistence so users stay logged in across app restarts.
 *
 * Environment variables come from `.env` via Expo's `process.env.EXPO_PUBLIC_*`
 * convention — these are embedded into the JS bundle at build time and are
 * safe to expose because every table is gated by Row-Level Security policies
 * scoped to `auth.uid()` (see Phase 3.1 migration 05_billing_and_rls).
 *
 * Usage:
 *   import { supabase } from "@/lib/supabase";
 *   const { data, error } = await supabase.from("tasks").select("*");
 */

import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { Database } from "../types/supabase";
import { logError } from "./error-log";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  logError(
    "supabase.init",
    new Error("Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY"),
    {
      hasUrl: Boolean(SUPABASE_URL),
      hasKey: Boolean(SUPABASE_ANON_KEY),
    },
  );
}

export const supabase = createClient<Database>(
  SUPABASE_URL ?? "",
  SUPABASE_ANON_KEY ?? "",
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // React Native has no URL fragment to parse, so skip the web-only
      // implicit flow detection. Deep-link callbacks (magic link / OAuth)
      // are handled manually in app/(auth)/verify.tsx.
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "x-client-info": "titan-protocol-mobile",
      },
    },
  },
);

/**
 * Helper: returns the currently authenticated user id, or throws if there
 * is no session. Use inside service-layer functions (Phase 3.3) that need
 * to scope a query to the current user. RLS enforces it at the DB level
 * too, but having the id in-hand avoids an extra roundtrip and makes
 * error messages clearer.
 */
export async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Not authenticated");
  }
  return data.user.id;
}
