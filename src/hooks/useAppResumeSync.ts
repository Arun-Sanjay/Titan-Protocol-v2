import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";

/**
 * App resume hook — invalidates every React Query cache on foreground
 * entry so screens with stale data refetch from SQLite.
 *
 * Before the local-first migration this also refreshed the Supabase
 * auth token; with SyncEngineMount mounted, the sync engine's own
 * AppState listener now drives push/pull (including any token refresh
 * that Supabase's client does internally), so that work is gone from
 * here. This hook only handles the refetch nudge.
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
