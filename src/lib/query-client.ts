/**
 * Mobile React Query client — uses shared factory + AsyncStorage persister.
 *
 * The shared createTitanQueryClient() provides consistent config (staleTime,
 * gcTime, retry). Mobile adds AsyncStorage-based persistence so the cache
 * survives app restarts (max age: 7 days).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createTitanQueryClient } from "@titan/shared/lib/query-client";

export const queryClient = createTitanQueryClient();

const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: "titan-rq-cache",
});

persistQueryClient({
  queryClient,
  persister: asyncStoragePersister,
  maxAge: 1000 * 60 * 60 * 24 * 7,
});
