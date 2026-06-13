import { useEffect, useState } from "react";
import { getLastSyncAt, countPendingRows } from "../sync/sync-status";

export interface SyncStatus {
  online: boolean;
  pending: number;
  failed: number;
  lastSyncAt: number | null;
}

/**
 * Live sync status for the UI: browser online/offline, count of pending
 * (`_dirty=1`) + dead-lettered (`_dirty=2`) rows, and the last confirmed
 * cloud round-trip. Polls the local cache cheaply (counts are tiny).
 */
export function useSyncStatus(pollMs = 5000): SyncStatus {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(getLastSyncAt());

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    let alive = true;
    const tick = async () => {
      try {
        const counts = await countPendingRows();
        if (!alive) return;
        setPending(counts.pending);
        setFailed(counts.failed);
        setLastSyncAt(getLastSyncAt());
      } catch {
        /* cache not ready yet — next tick retries */
      }
    };
    void tick();
    const id = setInterval(tick, pollMs);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [pollMs]);

  return { online, pending, failed, lastSyncAt };
}
