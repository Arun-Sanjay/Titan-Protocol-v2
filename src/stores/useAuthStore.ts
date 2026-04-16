import { create } from "zustand";
import { supabase, ensureProfileRow } from "../lib/supabase";
import { logError } from "../lib/error-log";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /** Read persisted session + subscribe to auth changes. Call once at root. */
  initialize: () => void;
  /** Sign out and clear session. */
  signOut: () => Promise<void>;
};

/**
 * Phase 0: Minimal auth store (Zustand).
 *
 * The single source of auth truth. Login screens call
 * `useAuthStore.setState({ session, user })` directly for
 * instant redirect (no waiting for onAuthStateChange round-trip).
 *
 * _layout.tsx gates the entire app on `isLoading` and `user`.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,

  initialize: () => {
    // Avoid double-init (React StrictMode, fast refresh)
    const { isLoading } = get();
    if (!isLoading) return;

    // Read the persisted session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
      if (session?.user) {
        ensureProfileRow(session.user.id, session.user.email ?? null).catch(
          (e) => logError("useAuthStore.ensureProfileRow.initial", e),
        );
      }
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
      if (session?.user && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
        ensureProfileRow(session.user.id, session.user.email ?? null).catch(
          (e) => logError("useAuthStore.ensureProfileRow.change", e, { event }),
        );
      }
    });

    // Store cleanup reference for potential future use
    (useAuthStore as unknown as { _unsub?: () => void })._unsub =
      subscription.unsubscribe;
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, user: null });
  },
}));
