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
      set((prev) => ({
        session: session ?? prev.session,
        user: session?.user ?? prev.user,
        isLoading: false,
      }));
      if (session?.user) {
        ensureProfileRow(session.user.id, session.user.email ?? null).catch(
          (e) => logError("useAuthStore.ensureProfileRow.initial", e),
        );
      }
    });

    // Subscribe to auth state changes (sign-in, sign-out, token refresh).
    //
    // Supabase emits INITIAL_SESSION on subscribe (possibly with a null
    // session while AsyncStorage is still hydrating). Treat that as
    // informational — never use it to CLEAR an already-signed-in user
    // that was set by login.tsx's direct setState. Only explicit
    // SIGNED_OUT should clear the store.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logError("useAuthStore.event", new Error(`auth: ${event}`), {
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      if (event === "INITIAL_SESSION" && !session) {
        // Don't clobber a user that was set synchronously by login.tsx.
        set({ isLoading: false });
        return;
      }
      if (event === "SIGNED_OUT") {
        set({ session: null, user: null, isLoading: false });
        return;
      }
      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION with session.
      if (session?.user) {
        set({ session, user: session.user, isLoading: false });
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          ensureProfileRow(session.user.id, session.user.email ?? null).catch(
            (e) => logError("useAuthStore.ensureProfileRow.change", e, { event }),
          );
        }
        return;
      }
      // Any other event with no session — fall through without clearing.
      set({ isLoading: false });
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
