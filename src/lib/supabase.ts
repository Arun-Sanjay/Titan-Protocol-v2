/**
 * Mobile Supabase client — delegates to @titan/shared with AsyncStorage.
 *
 * This file re-exports from the shared package so existing mobile imports
 * (`from "../lib/supabase"`) continue to work unchanged. The shared client
 * is initialized here with React Native's AsyncStorage for session persistence.
 */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { initSupabase, supabase, requireUserId } from "@titan/shared/lib/supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Initialize the shared Supabase client with mobile-specific storage.
// This runs at module evaluation time, before any service function is called.
initSupabase({
  url: SUPABASE_URL,
  anonKey: SUPABASE_ANON_KEY,
  storage: AsyncStorage,
  detectSessionInUrl: false,
});

// Re-export so existing `import { supabase } from "../lib/supabase"` works unchanged.
export { supabase, requireUserId };
