import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSettleStreaks } from "../hooks/queries/useProfile";
import { catchUpResync } from "../sync/resync";

/**
 * Runs the consistency-based streak settlement once per app-open — but only
 * AFTER a successful catch-up pull. Settlement folds past days from the
 * local cache; running it on a cache that missed other devices' Realtime
 * events (phone in a drawer for the weekend while the desktop did the work)
 * would score those days as empty and push zeroed ledger rows + a regressed
 * streak to the cloud, which Realtime then spreads everywhere.
 *
 * `settleStreaks()` is idempotent — it only scores past, unsettled days up
 * to yesterday — so a ref guard against a double-invoke is all that's
 * needed. RN port of web's `app/(os)/components/StreakSettlementGate.tsx`.
 * Renders nothing.
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
      if (res.status === "pulled") settle.mutate();
    })();
    // settle/queryClient are stable handles; run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
