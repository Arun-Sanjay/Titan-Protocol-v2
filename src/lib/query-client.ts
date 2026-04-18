import { QueryClient } from "@tanstack/react-query";

/**
 * React Query client.
 *
 * Since the local-first migration, SQLite is the source of truth; the
 * React Query cache is just an in-memory de-dup layer so two
 * components requesting the same query don't both hit SQLite in the
 * same tick. AsyncStorage persistence (persistQueryClient) was dropped
 * in Phase 5 — the SQLite database already survives app restarts, and
 * the cache refills on demand from SQLite (fast, no network) once
 * hooks run.
 *
 * staleTime = 0 so a freshly-read cache entry is re-fetched on the
 * next mount. SQLite reads are cheap (~1ms), so paying the query on
 * every mount beats handing the UI stale data during a sync push or
 * background pull.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 1000 * 60 * 60, // 1h — plenty for navigation back to a recent screen
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
