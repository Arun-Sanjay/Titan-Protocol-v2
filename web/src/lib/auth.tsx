/**
 * Web auth provider — the single source of truth for the signed-in user
 * on the web side. Wraps Supabase auth, pushes the user into the
 * service-layer session cache, and exposes `{ user, loading, signIn,
 * signUp, signOut, signInWithGoogle }` via `useWebAuth()`.
 *
 * Does NOT render a Loading fallback — the auth gate (see `OSLayout`)
 * handles the "still resolving" case and the "not signed in" redirect.
 * That keeps the unauthenticated routes (`/auth/login`, `/auth/callback`)
 * reachable without the provider swallowing them behind a spinner.
 */
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@titan/shared/lib/supabase";
import type { User, AuthResponse, OAuthResponse } from "@supabase/supabase-js";
import { setCurrentUser } from "./session";
import { subscribeUserChanges } from "../sync/realtime";
import { wipeAllSyncedTables } from "../sync/first-run-pull";
import { flushDirtyRows } from "../sync/flush-dirty";
import { catchUpResync } from "../sync/resync";
import { identifyUser, resetUser } from "./observability";

type WebAuthContextValue = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signUp: (email: string, password: string) => Promise<AuthResponse>;
  signInWithGoogle: () => Promise<OAuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
};

const WebAuthContext = createContext<WebAuthContextValue | null>(null);

export function WebAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      setCurrentUser(u?.id ?? null, u?.email ?? null);
      if (u) identifyUser({ id: u.id, email: u.email ?? undefined });
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      setCurrentUser(u?.id ?? null, u?.email ?? null);
      if (u) identifyUser({ id: u.id, email: u.email ?? undefined });
      else resetUser();
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Open a Realtime channel as soon as we have a user; close it on sign-out.
  // Cross-device sync goes here: any change another device makes to the
  // signed-in user's rows shows up in this tab's SQLite cache + React Query.
  useEffect(() => {
    if (!user?.id) return;
    const teardown = subscribeUserChanges(user.id, queryClient);
    // First land after sign-in: try to push any rows that were left _dirty=1
    // from a prior offline session. Idempotent — no dirty rows = no-op.
    void flushDirtyRows();
    return teardown;
  }, [user?.id, queryClient]);

  // Retry the dirty-row queue on network reconnect + on tab refocus.
  // Both are cheap no-ops when there's no dirty data, so firing eagerly
  // costs nothing. The flush has an in-flight guard against double-fire.
  useEffect(() => {
    if (!user?.id) return;
    // Network back → flush local writes up + catch up on anything other
    // devices changed while we were offline (Realtime doesn't replay gaps).
    const onOnline = () => {
      void catchUpResync(queryClient);
    };
    // Tab refocus (e.g. returning to the laptop after using the phone): if
    // the Realtime socket dropped while hidden we may have missed cross-device
    // changes — pull them down. If the socket stayed connected, changes
    // already arrived live; just flush any pending local writes.
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (!supabase.realtime.isConnected()) void catchUpResync(queryClient);
      else void flushDirtyRows();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [user?.id, queryClient]);

  const value = useMemo<WebAuthContextValue>(
    () => ({
      user,
      loading,
      signIn: (email, password) =>
        supabase.auth.signInWithPassword({ email, password }),
      signUp: (email, password) =>
        supabase.auth.signUp({ email, password }),
      signInWithGoogle: () =>
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            // HashRouter-safe: the callback route lives under the
            // hash, so the "#" here lands the browser on our in-app
            // route once Supabase hands back the session.
            redirectTo: window.location.origin + "/#/auth/callback",
          },
        }),
      signOut: async () => {
        // Wipe the local cache BEFORE telling Supabase to sign out. If
        // anything fails server-side, we'd rather have an empty cache
        // than a half-empty one. Next sign-in's first-run pull repopulates.
        await wipeAllSyncedTables();
        const { error } = await supabase.auth.signOut();
        return { error: error ?? null };
      },
    }),
    [user, loading],
  );

  return (
    <WebAuthContext.Provider value={value}>{children}</WebAuthContext.Provider>
  );
}

export function useWebAuth(): WebAuthContextValue {
  const ctx = useContext(WebAuthContext);
  if (!ctx) {
    throw new Error("useWebAuth must be called inside <WebAuthProvider>");
  }
  return ctx;
}
