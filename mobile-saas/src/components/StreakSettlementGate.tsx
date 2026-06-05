import { useEffect, useRef } from "react";
import { useSettleStreaks } from "../hooks/queries/useProfile";

/**
 * Runs the consistency-based streak settlement once per app-open. Mounted
 * inside `FirstRunPullGate` (so SQLite is populated from the cloud first) and
 * inside the React-Query provider. `settleStreaks()` is idempotent — it only
 * scores past, unsettled days up to yesterday — so a ref guard against a
 * double-invoke is all that's needed. RN port of web's
 * `app/(os)/components/StreakSettlementGate.tsx`. Renders nothing.
 */
export function StreakSettlementGate() {
  const settle = useSettleStreaks();
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;
    settle.mutate();
    // settle is a stable mutation handle; run exactly once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
