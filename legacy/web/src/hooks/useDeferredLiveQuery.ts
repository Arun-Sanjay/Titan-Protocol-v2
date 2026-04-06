"use client";

import * as React from "react";
import { useLiveQuery } from "dexie-react-hooks";

/**
 * Like useLiveQuery, but defers execution until after the first paint
 * via requestIdleCallback (or a 50ms fallback). This prevents non-critical
 * DB queries from blocking the initial render of a page.
 */
export function useDeferredLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: unknown[],
  defaultValue: T,
): T {
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = requestIdleCallback(() => setReady(true));
      return () => cancelIdleCallback(id);
    }
    // Fallback: fire after one animation frame + microtask
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const result = useLiveQuery(
    () => (ready ? querier() : defaultValue),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, ...deps],
  );

  return result ?? defaultValue;
}
