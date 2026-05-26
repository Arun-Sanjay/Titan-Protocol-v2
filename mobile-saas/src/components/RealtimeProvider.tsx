import React, { useEffect } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import { subscribeUserChanges } from "../sync/realtime";
import { flushDirtyRows } from "../sync/flush-dirty";

/**
 * Opens the Supabase Realtime channel for the signed-in user. Subscribes
 * to INSERT / UPDATE / DELETE on every synced table, applies each event
 * to local SQLite, and invalidates the matching React Query keys.
 *
 * Also drives the dirty-row replay: on the first land after sign-in and
 * on every AppState `active` transition (covers "phone was offline, now
 * back online" without needing NetInfo wired). The flush is idempotent
 * and a no-op when no dirty rows exist, so firing eagerly is cheap.
 *
 * Mount inside the authenticated tree so it can `useQueryClient()`.
 * Teardown fires automatically on sign-out (the `userId` dep changes
 * back to undefined and the cleanup closes the channel).
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId) return;
    const teardown = subscribeUserChanges(userId, queryClient);
    // First land after sign-in: replay anything left _dirty=1 by a previous
    // offline session.
    void flushDirtyRows();
    return teardown;
  }, [userId, queryClient]);

  // AppState 'active' transitions: replay dirty rows. Covers backgrounding
  // → reopen, OS sleep → wake, and the after-the-tunnel reconnect case.
  useEffect(() => {
    if (!userId) return;
    const handler = (state: AppStateStatus) => {
      if (state === "active") void flushDirtyRows();
    };
    const sub = AppState.addEventListener("change", handler);
    return () => sub.remove();
  }, [userId]);

  return <>{children}</>;
}
