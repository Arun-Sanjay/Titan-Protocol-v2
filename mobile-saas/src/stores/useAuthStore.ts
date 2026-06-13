import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
 * `signOut` clears this device's push token from the cloud profile (so
 * the next account doesn't receive the previous user's pushes), wipes
 * local SQLite (every synced table) BEFORE calling
 * `supabase.auth.signOut`, and resets the device-local onboarding flags.
 * The wipe-first ordering matters: if the cloud call fails we still
 * don't want the next user on this device to see the previous user's
 * cached rows.
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

    // Offline-tolerant cold start: rehydrate any persisted session straight
    // from storage BEFORE the network round-trip, so a returning user who
    // opens the app offline lands in their cached app instead of being
    // bounced to login. Additive only — getSession / INITIAL_SESSION below
    // still reconcile, and a real SIGNED_OUT clears it + wipes the cache.
    void hydratePersistedSession(get, set);

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
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
      })
      .catch((e) => {
        // Offline / transient: don't wedge on the splash. Any session the
        // optimistic rehydrate found is kept; otherwise INITIAL_SESSION
        // settles isLoading.
        logError("useAuthStore.getSession", e);
        set({ isLoading: false });
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
    // Remove this device's push token from the cloud profile FIRST — it
    // needs both the cached profile row and a live session, and skipping
    // it leaves the token on the old account so the next user on this
    // device receives the previous user's pushes (streak warnings etc.).
    // Dynamic import: push-token.ts imports this store.
    try {
      const { clearPushToken } = await import("../lib/push-token");
      await clearPushToken();
    } catch (e) {
      logError("useAuthStore.signOut.clearPushToken", e);
    }
    // Wipe the local cache BEFORE the cloud sign-out. If the network
    // call fails we still don't want the next account on this device
    // to see the previous user's rows.
    try {
      await wipeAllSyncedTables();
    } catch (e) {
      logError("useAuthStore.signOut.wipe", e);
    }
    // Reset device-local onboarding flags (the onboarding store's
    // documented sign-out contract) so the next account neither skips
    // onboarding nor inherits this user's identity/goals.
    try {
      const { useOnboardingStore } = await import("./useOnboardingStore");
      useOnboardingStore.getState().clearForSignOut();
    } catch (e) {
      logError("useAuthStore.signOut.onboarding", e);
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

/**
 * Read the persisted Supabase session straight from AsyncStorage and adopt
 * it if the store has no user yet. supabase-js can resolve `getSession()` to
 * null on an offline cold start (expired access token, no network to
 * refresh); without this, a returning user with a full local cache gets
 * bounced to login. Best-effort and additive — never clears a user, never
 * throws into boot.
 */
async function hydratePersistedSession(
  get: () => AuthState,
  set: (partial: Partial<AuthState>) => void,
) {
  try {
    if (get().user) return;
    const keys = await AsyncStorage.getAllKeys();
    const tokenKey = keys.find(
      (k) => k.startsWith("sb-") && k.endsWith("-auth-token"),
    );
    if (!tokenKey) return;
    const raw = await AsyncStorage.getItem(tokenKey);
    if (!raw) return;
    // supabase-js v2 stores the Session JSON directly; older gotrue nested
    // it under `currentSession`. Handle both, defensively.
    const parsed = JSON.parse(raw) as
      | (Session & { currentSession?: Session })
      | null;
    const session = (parsed?.currentSession ?? parsed) as Session | null;
    if (session?.user && !get().user) {
      set({ session, user: session.user, isLoading: false });
    }
  } catch (e) {
    logError("useAuthStore.hydratePersisted", e);
  }
}

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
