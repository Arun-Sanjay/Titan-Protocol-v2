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
 * ─── Spurious SIGNED_OUT recovery ───────────────────────────────────────────
 *
 * supabase-js emits `SIGNED_OUT` on a bunch of failure modes that aren't
 * "the user actually signed out" — the most common being a 429 on the
 * /token refresh endpoint. The initial seed (42 sequential PostgREST
 * queries) can tickle the refresh cascade even with fresh tokens,
 * especially with any device clock skew. Phase 4 removed the recovery
 * path assuming local-first made cascades impossible; the seed then
 * surfaced the exact scenario the recovery was built for.
 *
 * Recovery: if we get SIGNED_OUT but still hold a refresh_token in
 * memory, try `setSession` ONCE to re-validate. On success, keep the
 * user. On failure, accept the sign-out as real and route to login.
 */

let explicitSignOut = false;
let recoveryInFlight = false;
let lastRecoveryAttempt = 0;
let lastEnsuredProfileFor: string | null = null;

/** Don't retry recovery more than once per window. Cascade defence. */
const RECOVERY_COOLDOWN_MS = 60_000;

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
        handleSignedOut(get, set);
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
    explicitSignOut = true;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      logError("useAuthStore.signOut", e);
    } finally {
      set({ session: null, user: null });
      explicitSignOut = false;
      lastEnsuredProfileFor = null;
    }
  },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget profile upsert, deferred out of the onAuthStateChange
 * callback (supabase-js docs forbid Supabase calls inside callbacks — they
 * can deadlock on the internal lock). Local-first: writes SQLite + outbox.
 */
function scheduleEnsureProfile(userId: string, email: string | null) {
  if (lastEnsuredProfileFor === userId) return;
  lastEnsuredProfileFor = userId;
  setTimeout(() => {
    import("../services/profile")
      .then(({ upsertProfile }) => upsertProfile({ email }))
      .catch((e) =>
        logError("useAuthStore.ensureProfileRow", e, { userId }),
      );
  }, 0);
}

/**
 * Handle a SIGNED_OUT event.
 *
 * Explicit sign-out: clear immediately.
 * Stray sign-out (429 cascade, etc.): try setSession once. `setSession`
 * uses strict JWT expiry (no 90s margin), so if the access token has any
 * life left it'll re-validate without triggering another refresh. If it
 * genuinely fails, THEN we clear and the root layout redirects to login.
 */
function handleSignedOut(
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
) {
  if (explicitSignOut) {
    set({ session: null, user: null, isLoading: false });
    explicitSignOut = false;
    lastEnsuredProfileFor = null;
    return;
  }

  const snapshot = get().session;
  if (!snapshot?.refresh_token || !snapshot.access_token) {
    set({ session: null, user: null, isLoading: false });
    lastEnsuredProfileFor = null;
    return;
  }

  const now = Date.now();
  if (recoveryInFlight || now - lastRecoveryAttempt < RECOVERY_COOLDOWN_MS) {
    // Already mid-recovery, or cascade is repeating. Accept the sign-out.
    recoveryInFlight = false;
    set({ session: null, user: null, isLoading: false });
    lastEnsuredProfileFor = null;
    return;
  }

  recoveryInFlight = true;
  lastRecoveryAttempt = now;

  // Short delay lets any rate-limit window pass before we touch /user.
  setTimeout(() => {
    supabase.auth
      .setSession({
        access_token: snapshot.access_token,
        refresh_token: snapshot.refresh_token,
      })
      .then(({ data, error }) => {
        recoveryInFlight = false;
        if (error || !data.session) {
          logError(
            "useAuthStore.recovery.failed",
            error ?? new Error("setSession returned no session"),
          );
          set({ session: null, user: null, isLoading: false });
          lastEnsuredProfileFor = null;
          return;
        }
        // setSession fires its own SIGNED_IN; this set() is defensive.
        set({
          session: data.session,
          user: data.session.user,
          isLoading: false,
        });
      })
      .catch((e) => {
        // Network error during recovery — keep session so user can continue.
        recoveryInFlight = false;
        logError("useAuthStore.recovery.network", e);
      });
  }, 1500);
}
