import { create } from "zustand";
import { supabase } from "../lib/supabase";
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
 * Minimal auth store (Zustand) — the single source of auth truth for the UI.
 *
 * Login screens call `useAuthStore.setState({ session, user })` directly for
 * instant redirect (no waiting for onAuthStateChange round-trip). `_layout.tsx`
 * gates the entire app on `isLoading` and `user`.
 *
 * Before the local-first migration, this store carried a defensive recovery
 * path for stray SIGNED_OUT events. The root cause was supabase-js firing a
 * refresh on every PostgREST request (via `_getAccessToken`'s 90s expiry
 * margin) — with clock skew + back-to-back reads during onboarding, the
 * refreshes cascaded into a 429 rate limit, after which supabase-js cleared
 * the session. Once the service layer became SQLite-authoritative (Phase 2),
 * PostgREST stopped running on the per-tap path — push/pull fire on AppState
 * transitions and a 60s interval, not per-interaction. Without the cascade
 * there's nothing to recover from; SIGNED_OUT means SIGNED_OUT.
 *
 * What's left here: the `explicitSignOut` flag is still useful so the
 * ensureProfileRow dedup key resets cleanly; `scheduleEnsureProfile` still
 * defers out of the callback per supabase-js docs.
 */

// Dedup key so SIGNED_IN + TOKEN_REFRESHED in quick succession upsert the
// profile at most once per user.
let lastEnsuredProfileFor: string | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,

  initialize: () => {
    const { isLoading } = get();
    if (!isLoading) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      set((prev) => ({
        session: session ?? prev.session,
        user: session?.user ?? prev.user,
        isLoading: false,
      }));
      if (session?.user) {
        scheduleEnsureProfile(session.user.id, session.user.email ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      logError("useAuthStore.event", new Error(`auth: ${event}`), {
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });

      if (event === "INITIAL_SESSION" && !session) {
        set({ isLoading: false });
        return;
      }

      if (event === "SIGNED_OUT") {
        set({ session: null, user: null, isLoading: false });
        lastEnsuredProfileFor = null;
        return;
      }

      // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED / INITIAL_SESSION(session).
      if (session?.user) {
        set({ session, user: session.user, isLoading: false });
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          scheduleEnsureProfile(session.user.id, session.user.email ?? null);
        }
        return;
      }

      set({ isLoading: false });
    });

    (useAuthStore as unknown as { _unsub?: () => void })._unsub =
      subscription.unsubscribe;
  },

  signOut: async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      logError("useAuthStore.signOut", e);
    } finally {
      set({ session: null, user: null });
      lastEnsuredProfileFor = null;
    }
  },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget profile upsert, deferred out of the onAuthStateChange
 * callback (supabase-js docs forbid Supabase calls inside callbacks — they
 * can deadlock on the internal lock).
 *
 * Local-first: the upsert writes to SQLite + enqueues the profile for push.
 * No network hit on the auth flow itself.
 */
function scheduleEnsureProfile(userId: string, email: string | null) {
  if (lastEnsuredProfileFor === userId) return;
  lastEnsuredProfileFor = userId;
  setTimeout(() => {
    // Lazy import to avoid a cycle (profile service imports the auth store's
    // requireUserId path via lib/supabase).
    import("../services/profile")
      .then(({ upsertProfile }) =>
        upsertProfile({
          email,
        }),
      )
      .catch((e) =>
        logError("useAuthStore.ensureProfileRow", e, { userId }),
      );
  }, 0);
}
