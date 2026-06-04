/**
 * Web React Query client.
 *
 * Config mirrors what the (now-removed) shared factory provided:
 *   - 5 min staleTime: queries re-fetch on mount only if older than 5 min
 *   - 24h gcTime: cached data survives in memory for a full day
 *   - retry: 2 attempts before giving up
 *   - No refetchOnWindowFocus: user controls when to refresh
 *
 * In a local-first app with ~1ms SQLite reads, staleTime barely matters —
 * re-running a query is cheap. The longer gcTime is what helps: if the
 * user navigates back to a screen they visited a few hours ago, the
 * cached result shows instantly while SQLite serves a fresh read in the
 * background.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
