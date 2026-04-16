import { QueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";

/**
 * Phase 0: React Query client with AsyncStorage offline cache.
 *
 * - 5 min staleTime: queries re-fetch on mount only if older than 5 min.
 * - gcTime 24h: cached data survives in memory for a full day.
 * - Persister writes the cache to AsyncStorage so it survives app restarts.
 *   Max age 7 days — after that, the cache is rebuilt from Supabase.
 */
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

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "titan-rq-cache",
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
});
