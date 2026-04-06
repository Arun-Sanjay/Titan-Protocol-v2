/**
 * Phase 3.4c: App-resume background sync.
 *
 * When the app returns from background (AppState 'active'), invalidate
 * the React Query caches that matter for the live UX:
 *   - profile (XP, level, streak)
 *   - today's completions (across all engines)
 *   - today's habit logs
 *   - pending rank-ups (for the overlay)
 *
 * Everything else can keep serving stale data until the user navigates
 * to it (React Query will refetch on mount per our defaults).
 *
 * This hook is mounted once from the root layout. It's a no-op until
 * the user signs in and we have data in the cache worth refreshing.
 *
 * Why not rely on React Query's refetchOnWindowFocus?
 *   - RN doesn't fire the browser 'focus' event, so that option is
 *     effectively dead on mobile
 *   - AppState is the RN-native equivalent and we were already using
 *     it in the old code for the same purpose
 *
 * Throttling: the hook skips invalidation if the app became active less
 * than 30 seconds after the last sync. Prevents hammering Supabase when
 * users rapidly app-switch.
 */

import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "../stores/useAuthStore";
import { profileQueryKey } from "./queries/useProfile";
import { tasksKeys } from "./queries/useTasks";
import { habitsKeys } from "./queries/useHabits";
import { rankUpsKeys } from "./queries/useRankUps";
import { getTodayKey } from "../lib/date";

const MIN_SYNC_INTERVAL_MS = 30_000;

export function useAppResumeSync(): void {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const lastSyncRef = useRef<number>(0);

  useEffect(() => {
    if (!user) return; // No-op until signed in.

    const handleChange = (state: AppStateStatus) => {
      if (state !== "active") return;

      const now = Date.now();
      if (now - lastSyncRef.current < MIN_SYNC_INTERVAL_MS) return;
      lastSyncRef.current = now;

      const todayKey = getTodayKey();

      // Invalidate the live queries. React Query handles the rest:
      // - fires refetches for each in parallel
      // - shows stale data from cache until fresh data arrives
      // - debounces subscribers so there's no render storm
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
      queryClient.invalidateQueries({
        queryKey: tasksKeys.completionsByDate(todayKey),
      });
      queryClient.invalidateQueries({
        queryKey: habitsKeys.logsByDate(todayKey),
      });
      queryClient.invalidateQueries({ queryKey: rankUpsKeys.pending() });
    };

    // Fire once on mount so a fresh launch also runs a sync (useful if
    // the user spent >30s on the login screen before signing in).
    handleChange(AppState.currentState);

    const sub = AppState.addEventListener("change", handleChange);
    return () => sub.remove();
  }, [queryClient, user]);
}
