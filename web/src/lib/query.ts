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
import { QueryClient, MutationCache } from "@tanstack/react-query";
import { toast, messageFromError } from "./toast";
import { PaywallError, openPaywall } from "./paywall";

export const queryClient = new QueryClient({
  // One global handler surfaces EVERY failed mutation as a toast — web
  // previously rolled back optimistic updates silently (audit §5.2). Cloud
  // write failures are reassuring (the row is mirrored `_dirty=1` and the
  // dirty-row replay retries), so `messageFromError` phrases them that way.
  mutationCache: new MutationCache({
    onError: (error) => {
      // A gated action past the free trial throws PaywallError — open the
      // subscribe modal instead of surfacing a scary error toast.
      if (error instanceof PaywallError) {
        openPaywall();
        return;
      }
      toast.error(messageFromError(error));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 60 * 24,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});
