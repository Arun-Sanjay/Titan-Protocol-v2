/**
 * Phase 3.2: Auth store.
 *
 * Thin Zustand wrapper around supabase.auth. Subscribes to
 * `onAuthStateChange` and exposes the current session/user + loading
 * state to the rest of the app.
 *
 * The store is deliberately minimal — it doesn't hold profile data.
 * Profile data belongs in React Query (Phase 3.3) so it can be cached,
 * re-fetched on focus, and invalidated after mutations.
 *
 * Route guarding (app/_layout.tsx) subscribes to `isLoading` and `user`
 * to decide between the auth stack, onboarding, or the main app.
 */

import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { logError } from "../lib/error-log";

type AuthState = {
  /** The current session, or null if not signed in. */
  session: Session | null;
  /** Convenience accessor — session?.user. */
  user: User | null;
  /**
   * True until we've hydrated the initial session from AsyncStorage.
   * The root layout should show the splash screen while this is true
   * to avoid a flash of the auth screen for already-logged-in users.
   */
  isLoading: boolean;
  /**
   * Initialize the store. Must be called once at app startup (from the
   * root layout). Reads the persisted session from AsyncStorage and
   * subscribes to onAuthStateChange. Idempotent — calling it twice is
   * a no-op after the first call.
   */
  initialize: () => Promise<void>;
  /** Sign the user out and clear the session. */
  signOut: () => Promise<void>;
};

let initialized = false;
let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  user: null,
  isLoading: true,

  initialize: async () => {
    if (initialized) return;
    initialized = true;

    try {
      // Hydrate the initial session from AsyncStorage.
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        logError("useAuthStore.initialize", error);
      }
      set({
        session: data.session,
        user: data.session?.user ?? null,
        isLoading: false,
      });

      // Subscribe to future auth events (sign-in, sign-out, token refresh).
      // Phase 4.2: filter by event type to prevent brief logouts during
      // token refresh failures. Previously, ANY event with a null session
      // (including transient refresh errors) would clear the user, causing
      // the root layout to redirect to /(auth)/login for a few frames.
      // Now we only clear on explicit SIGNED_OUT — all other events must
      // carry a valid session to update state.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          set({ session: null, user: null });
        } else if (session) {
          set({ session, user: session.user });
        }
        // If session is null but event isn't SIGNED_OUT (e.g. transient
        // refresh failure, INITIAL_SESSION race), keep current state.
        // getSession() already set the authoritative initial state above.
      });
      authSubscription = sub.subscription;
    } catch (e) {
      logError("useAuthStore.initialize", e);
      set({ session: null, user: null, isLoading: false });
    }
  },

  signOut: async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        logError("useAuthStore.signOut", error);
      }
      set({ session: null, user: null });
    } catch (e) {
      logError("useAuthStore.signOut", e);
    }
  },
}));

/**
 * For test cleanup and hot-reload safety.
 * Not part of the public API; do not call in app code.
 */
export function __resetAuthStoreForTests(): void {
  initialized = false;
  authSubscription?.unsubscribe();
  authSubscription = null;
  useAuthStore.setState({ session: null, user: null, isLoading: true });
}
