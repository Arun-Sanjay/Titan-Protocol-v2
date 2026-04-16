import { create } from "zustand";
import { supabase } from "../lib/supabase";
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
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user ?? null,
        isLoading: false,
      });
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
