/**
 * Phase 3.4b: `useIsOnline` hook.
 *
 * Thin wrapper around React Query's onlineManager so any component can
 * subscribe to network state without a direct NetInfo dependency. The
 * manager is wired to NetInfo in src/lib/query-client.ts.
 *
 * Returns `true` when the device reports both `isConnected` and
 * `isInternetReachable` (the NetInfo listener masks the flaky "captive
 * portal" case where isConnected is true but packets don't route).
 */

import { useEffect, useState } from "react";
import { onlineManager } from "@tanstack/react-query";

export function useIsOnline(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(() => onlineManager.isOnline());

  useEffect(() => {
    const unsubscribe = onlineManager.subscribe((online) => {
      setIsOnline(online);
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return isOnline;
}
