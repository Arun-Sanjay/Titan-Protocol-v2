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
 * Minimal auth store (Zustand) — the single source of auth truth for the UI.
 *
 * Login screens call `useAuthStore.setState({ session, user })` directly for
 * instant redirect (no waiting for onAuthStateChange round-trip). `_layout.tsx`
 * gates the entire app on `isLoading` and `user`.
 *
 * ─── The spurious SIGNED_OUT problem ────────────────────────────────────────
 *
 * supabase-js's `_getAccessToken` runs on every API request and calls
 * `auth.getSession()` under the hood. `getSession` uses an `EXPIRY_MARGIN_MS`
 * of 90s — if `expires_at - Date.now() < 90_000` (even once, due to modest
 * device clock skew), it triggers `_callRefreshToken`. The `refreshingDeferred`
 * lock dedupes CONCURRENT refreshes, but sequential queries each trigger their
 * own. A burst of React Query fetches right after sign-in can therefore cause
 * a chain of 20+ /token refresh calls in a few seconds. Once Supabase rate-
 * limits with 429, supabase-js treats it as non-retryable and calls
 * `_removeSession()`, which emits `SIGNED_OUT` and wipes the persisted session
 * from AsyncStorage. That's what was kicking users back to the login screen
 * mid-onboarding.
 *
 * Fix: distinguish between an explicit `signOut()` (UI-initiated) and a stray
 * `SIGNED_OUT` from supabase-js's internal error handling. On stray ones we
 * attempt a quiet recovery via `setSession`, and only clear the user if that
 * recovery itself fails. We also defer `ensureProfileRow` out of the auth
 * callback per the supabase-js docs (callbacks must not make other Supabase
 * calls — risk of deadlock through the internal lock).
 */

// Module-level coordination flags for the onAuthStateChange handler. Kept
// outside the store so the callback doesn't need to read them via get().
let explicitSignOut = false;
let recoveryInFlight = false;
let lastRecoveryAttempt = 0;
let lastEnsuredProfileFor: string | null = null;

/** Don't attempt recovery more than once per this window — if a cascade keeps
 *  emitting SIGNED_OUT, accept it as real after a retry and a cooldown. */
const RECOVERY_COOLDOWN_MS = 60_000;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,

  initialize: () => {
    // Avoid double-init (React StrictMode, fast refresh)
    const { isLoading } = get();
    if (!isLoading) return;

    // Read the persisted session. Uses `prev` state so that if a login screen
    // called setState synchronously before this async read resolved, we don't
    // clobber the fresh user with a stale null.
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

    // Subscribe to auth state changes. See the file-level doc comment for the
    // design rationale around stray SIGNED_OUT events.
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

      // Any other event with no session — settle loading without clearing.
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
      // Belt-and-suspenders: the SIGNED_OUT event handler will have already
      // cleared state, but if supabase.auth.signOut rejected before firing
      // the event we still want the store to reflect the user's intent.
      set({ session: null, user: null });
      explicitSignOut = false;
    }
  },
}));

// ─── helpers ────────────────────────────────────────────────────────────────

/**
 * Fire-and-forget `ensureProfileRow` deferred to the next tick so it runs
 * OUTSIDE the onAuthStateChange callback (supabase-js docs forbid making
 * Supabase calls inside callbacks — they can deadlock on the internal lock).
 *
 * Also dedupes: if the same user id fired SIGNED_IN/TOKEN_REFRESHED several
 * times in quick succession (e.g. during a refresh cascade), we only hit the
 * profiles upsert once per user id.
 */
function scheduleEnsureProfile(userId: string, email: string | null) {
  if (lastEnsuredProfileFor === userId) return;
  lastEnsuredProfileFor = userId;
  setTimeout(() => {
    ensureProfileRow(userId, email).catch((e) =>
      logError("useAuthStore.ensureProfileRow", e, { userId }),
    );
  }, 0);
}

/**
 * Handle a SIGNED_OUT event.
 *
 * Explicit sign-out (user tapped "Sign out"): clear immediately.
 *
 * Stray sign-out (supabase-js internal error, almost always a 429 rate-limit
 * on /token?grant_type=refresh_token): try to restore the session from what
 * we have in memory. `setSession` uses strict JWT exp (no 90s margin), so if
 * the access token still has any life left — even with clock skew — it won't
 * trigger another refresh; it just re-validates via /user and re-persists
 * the session. If setSession genuinely fails (session actually dead), THEN
 * we clear and the root layout redirects to login.
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

  const prev = get();
  const snapshot = prev.session;

  if (!snapshot?.refresh_token || !snapshot.access_token) {
    // Nothing to recover from — accept the sign-out as real.
    set({ session: null, user: null, isLoading: false });
    lastEnsuredProfileFor = null;
    return;
  }

  const now = Date.now();
  if (recoveryInFlight || now - lastRecoveryAttempt < RECOVERY_COOLDOWN_MS) {
    // Already mid-recovery, OR we just recovered recently and the cascade is
    // repeating. Accept the sign-out rather than bouncing forever.
    recoveryInFlight = false;
    set({ session: null, user: null, isLoading: false });
    lastEnsuredProfileFor = null;
    return;
  }

  recoveryInFlight = true;
  lastRecoveryAttempt = now;

  // Keep the user in the UI while we recover; don't flash a redirect.
  // A short delay lets any rate-limit window pass before we touch /user.
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
        // setSession fires its own SIGNED_IN which the main handler will
        // process — this set() is just a defensive sync in case the emitter
        // ran before we got here.
        set({
          session: data.session,
          user: data.session.user,
          isLoading: false,
        });
      })
      .catch((e) => {
        // Network error during recovery — assume transient and keep the
        // session in the store so the user can continue. The autoRefresh
        // ticker will converge us when connectivity returns.
        recoveryInFlight = false;
        logError("useAuthStore.recovery.network", e);
      });
  }, 1500);
}
