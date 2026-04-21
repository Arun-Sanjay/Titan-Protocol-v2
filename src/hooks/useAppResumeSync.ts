import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

/**
 * App resume hook — invalidates every React Query cache on foreground
 * entry so screens with stale data refetch from SQLite. SQLite reads
 * are cheap (~1ms) so this is low-cost, and it keeps the UI in sync
 * with any writes that happened while the app was backgrounded.
 *
 * Throttled to once per 30s so a rapid-fire background/foreground
 * transition doesn't thrash every active query.
 */
export function useAppResumeSync() {
  const qc = useQueryClient();
  const lastRefresh = useRef(0);

  useEffect(() => {
    const handle = (next: AppStateStatus) => {
      if (next !== "active") return;
      const now = Date.now();
      if (now - lastRefresh.current < 30_000) return;
      lastRefresh.current = now;
      qc.invalidateQueries();
    };

    const sub = AppState.addEventListener("change", handle);
    return () => sub.remove();
  }, [qc]);
}
