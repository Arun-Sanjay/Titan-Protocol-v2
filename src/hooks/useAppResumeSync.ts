import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { handleAppOpenAfterGap } from "../lib/safety";
import { logError } from "../lib/error-log";

/**
 * App resume hook — invalidates every React Query cache on foreground
 * entry so screens with stale data refetch from SQLite. SQLite reads
 * are cheap (~1ms) so this is low-cost, and it keeps the UI in sync
 * with any writes that happened while the app was backgrounded.
 *
 * Throttled to once per 30s so a rapid-fire background/foreground
 * transition doesn't thrash every active query.
 *
 * Also runs `handleAppOpenAfterGap` on initial mount + each foreground
 * entry (subject to the same throttle). That helper generates Monday's
 * weekly quests and advances the progression phase when needed —
 * without a caller, both stayed empty forever.
 */
export function useAppResumeSync() {
  const qc = useQueryClient();
  const lastRefresh = useRef(0);

  useEffect(() => {
    // Initial-mount run. Fires once per app launch so a user who installs
    // on Monday morning sees quests appear instead of having to wait for
    // a backgroud → foreground transition.
    lastRefresh.current = Date.now();
    handleAppOpenAfterGap().catch((e) =>
      logError("useAppResumeSync.initial", e),
    );

    const handle = (next: AppStateStatus) => {
      if (next !== "active") return;
      const now = Date.now();
      if (now - lastRefresh.current < 30_000) return;
      lastRefresh.current = now;
      qc.invalidateQueries();
      handleAppOpenAfterGap().catch((e) =>
        logError("useAppResumeSync.resume", e),
      );
    };

    const sub = AppState.addEventListener("change", handle);
    return () => sub.remove();
  }, [qc]);
}
