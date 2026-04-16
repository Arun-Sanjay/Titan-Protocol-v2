import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

/**
 * Phase 3.4c: App resume sync hook.
 *
 * When the app returns to the foreground:
 * 1. Refreshes the Supabase auth token (throttled: max once per 30s)
 * 2. Invalidates all React Query caches so screens refetch fresh data
 *
 * Must be mounted inside the QueryClientProvider tree.
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

      // Refresh auth token
      supabase.auth.getSession().catch(() => {
        // Silently ignore — offline is fine
      });

      // Invalidate all queries so screens refetch
      qc.invalidateQueries();
    };

    const sub = AppState.addEventListener("change", handle);
    return () => sub.remove();
  }, [qc]);
}
