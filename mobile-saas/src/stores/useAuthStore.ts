import { create } from "zustand";
import { supabase } from "../lib/supabase";
import { logError } from "../lib/error-log";
import { queryClient } from "../lib/query-client";
import { wipeAllSyncedTables } from "../sync/first-run-pull";
import type { Session, User } from "@supabase/supabase-js";

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  /** Read persisted session + subscribe to auth changes. Call once at root. */
  initialize: () => void;
  /** Sign out and clear session. M2 will add wipeAllSyncedTables() ahead of signOut. */
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
 * /token refresh endpoint. The hybrid data layer can fire bursts of
 * cloudUpsert writes that tickle the same refresh cascades.
 *
 * Recovery: if we get SIGNED_OUT but still hold a refresh_token in
 * memory, try `setSession` ONCE to re-validate. On success, keep the
 * user. On failure, accept the sign-out as real and route to login.
 *
 * ─── Sign-out ───────────────────────────────────────────────────────────────
 *
 * `signOut` wipes local SQLite (every synced table) BEFORE calling
 * `supabase.auth.signOut`. The wipe-first ordering matters: if the cloud
 * call fails we still don't want the next user on this device to see the
 * previous user's cached rows. Onboarding-store clearing (Classic's
 * dynamic import of `useOnboardingStore`) lands in M5; services/profile
 * ensure-row lands in M3.
 */

let explicitSignOut = false;
let recoveryInFlight = false;
let lastRecoveryAttempt = 0;

const RECOVERY_COOLDOWN_MS = 60_000;

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  user: null,
  isLoading: true,

  initialize: () => {
    const { isLoading } = get();
    if (!isLoading) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const nextUser = session?.user ?? null;
      const prevUserId = get().user?.id ?? null;
      if (nextUser && prevUserId !== nextUser.id) {
        queryClient.clear();
      }
      set((prev) => ({
        session: session ?? prev.session,
        user: nextUser ?? prev.user,
        isLoading: false,
      }));
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

      if (session?.user) {
        const prevUserId = get().user?.id ?? null;
        if (prevUserId !== session.user.id) {
          queryClient.clear();
        }
        set({ session, user: session.user, isLoading: false });
        return;
      }

      set({ isLoading: false });
    });

    (useAuthStore as unknown as { _unsub?: () => void })._unsub =
      subscription.unsubscribe;
  },

  signOut: async () => {
    explicitSignOut = true;
    // Wipe the local cache BEFORE the cloud sign-out. If the network
    // call fails we still don't want the next account on this device
    // to see the previous user's rows.
    try {
      await wipeAllSyncedTables();
    } catch (e) {
      logError("useAuthStore.signOut.wipe", e);
    }
    try {
      await supabase.auth.signOut();
    } catch (e) {
      logError("useAuthStore.signOut", e);
    } finally {
      queryClient.clear();
      set({ session: null, user: null });
      explicitSignOut = false;
    }
  },
}));

function handleSignedOut(
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
) {
  if (explicitSignOut) {
    queryClient.clear();
    set({ session: null, user: null, isLoading: false });
    explicitSignOut = false;
    return;
  }

  const snapshot = get().session;
  if (!snapshot?.refresh_token || !snapshot.access_token) {
    queryClient.clear();
    set({ session: null, user: null, isLoading: false });
    return;
  }

  const now = Date.now();
  if (recoveryInFlight || now - lastRecoveryAttempt < RECOVERY_COOLDOWN_MS) {
    recoveryInFlight = false;
    queryClient.clear();
    set({ session: null, user: null, isLoading: false });
    return;
  }

  recoveryInFlight = true;
  lastRecoveryAttempt = now;

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
          queryClient.clear();
          set({ session: null, user: null, isLoading: false });
          return;
        }
        set({
          session: data.session,
          user: data.session.user,
          isLoading: false,
        });
      })
      .catch((e) => {
        recoveryInFlight = false;
        logError("useAuthStore.recovery.network", e);
      });
  }, 1500);
}
