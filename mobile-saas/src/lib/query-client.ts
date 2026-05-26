import { QueryClient } from "@tanstack/react-query";

/**
 * React Query client — single source of truth for the cache.
 *
 * SaaS mobile (hybrid): SQLite is a local read cache, Supabase is the
 * authoritative store. Reads stay local (~1ms); the cache mostly exists
 * to de-dup in-flight queries within a render pass. A Realtime
 * subscription pushes other devices' writes into SQLite + invalidates
 * the matching query keys.
 *
 * staleTime: 5min — local reads are cheap, but we don't want to re-run
 * every query on every mount. The Realtime invalidator drives freshness.
 * gcTime: 24h — keep cached query data through long navigation without
 * re-reading SQLite on screen re-entry.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
