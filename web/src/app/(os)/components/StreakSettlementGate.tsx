import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettleStreaks } from "../../../hooks/queries/useProfile";
import { catchUpResync } from "../../../sync/resync";
import { runAchievementCheck } from "../../../lib/achievement-integration";

/**
 * Runs the consistency-based streak settlement once per app-open — but only
 * AFTER a successful catch-up pull. Settlement folds past days from the
 * local cache; running it on a cache that missed other devices' Realtime
 * events (laptop closed for the weekend while the phone did the work) would
 * score those days as empty and push zeroed ledger rows + a regressed
 * streak to the cloud, which Realtime then spreads everywhere.
 *
 * `settleStreaks()` is idempotent — it only scores past, unsettled days up
 * to yesterday — so a ref guard against StrictMode's double-invoke is all
 * that's needed. Renders nothing.
 */
export function StreakSettlementGate() {
  const queryClient = useQueryClient();
  const settle = useSettleStreaks();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    void (async () => {
      const res = await catchUpResync(queryClient, { force: true });
      // Anything other than a completed pull means the cache may still be
      // stale (offline, dirty rows pending, pull failed). Don't settle —
      // the next app-open retries.
      // After a clean pull + settle, re-evaluate achievements with the
      // fresh streak/day-count so streak- and day-based unlocks fire on
      // app-open, not only after a task toggle.
      if (res.status === "pulled") {
        settle.mutate(undefined, {
          onSuccess: () => {
            void runAchievementCheck(queryClient);
          },
        });
      }
    })();
    // settle/queryClient are stable handles; run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
