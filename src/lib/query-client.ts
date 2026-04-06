/**
 * Phase 3.3a + 3.4: React Query client + MMKV-backed persister + offline
 * mutation queue.
 *
 * React Query is the data layer for Supabase reads/writes. It provides:
 *   - Smart caching (stale-while-revalidate) so repeated reads are free
 *   - Automatic refetch on mount / app focus / network reconnect
 *   - Optimistic updates via mutation callbacks
 *   - Retry with exponential backoff on transient errors
 *   - Query invalidation so mutations can keep all dependent queries fresh
 *
 * Persistence uses MMKV (via `src/db/storage.ts`) wrapped in an AsyncStorage-
 * shaped adapter so the React Query persist-client can use it. This means:
 *   - Cached data hydrates instantly on app launch (no flash of loading)
 *   - Users who open the app offline see their last-known state immediately
 *   - Mutations pending because the device is offline are persisted to MMKV
 *     and auto-resumed when network returns (or the app restarts online)
 *
 * Stale time is intentionally short for user data (5 min) and longer for
 * slow-changing data (achievements, skill tree definitions). Default 5 min.
 *
 * Offline queue design (Phase 3.4):
 *   - Queries pause when the device goes offline (React Query default
 *     behavior via onlineManager)
 *   - Mutations retry until they succeed. If the device goes offline
 *     mid-retry, the mutation enters a "paused" state and is serialized
 *     to the persisted cache.
 *   - On reconnect, the NetInfo listener flips onlineManager back on AND
 *     calls resumePausedMutations() so queued writes fire in order.
 *   - On app launch, hydration restores the queue too. A force-kill or
 *     device reboot doesn't lose pending writes.
 *
 * Conflict resolution is handled at the DB level via `updated_at` triggers
 * (see Phase 3.1 migration 01_foundation). Last-write-wins for tasks /
 * habits / journal / logs. Server-authoritative for streaks, protocol,
 * progression, achievements, rank-ups (those aren't client-mutated on the
 * same row from multiple devices anyway).
 */

import { QueryClient, onlineManager } from "@tanstack/react-query";
import { persistQueryClient } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import NetInfo from "@react-native-community/netinfo";

import { storage } from "../db/storage";
import { logError } from "./error-log";

// ─── MMKV → AsyncStorage adapter ────────────────────────────────────────────
// React Query's persist-client expects an async KV store shape. MMKV is
// synchronous but the interface still works — we just wrap calls in
// Promise.resolve. Zero overhead in practice because MMKV reads are
// microsecond-level.

const MMKV_CACHE_KEY = "titan_query_cache";

const mmkvAsyncAdapter = {
  getItem: (key: string): Promise<string | null> => {
    try {
      const value = storage.getString(key);
      return Promise.resolve(value ?? null);
    } catch (e) {
      logError("query-client.mmkv.getItem", e, { key });
      return Promise.resolve(null);
    }
  },
  setItem: (key: string, value: string): Promise<void> => {
    try {
      storage.set(key, value);
    } catch (e) {
      logError("query-client.mmkv.setItem", e, { key, valueLength: value.length });
    }
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    try {
      storage.remove(key);
    } catch (e) {
      logError("query-client.mmkv.removeItem", e, { key });
    }
    return Promise.resolve();
  },
};

// ─── QueryClient with sensible defaults ─────────────────────────────────────

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 5 minutes before data is considered stale and eligible for refetch.
      // Keeps the app responsive without hammering Supabase.
      staleTime: 5 * 60 * 1000,
      // Keep cached data for 24 hours even if no component is using it.
      // The MMKV persister extends this across app restarts.
      gcTime: 24 * 60 * 60 * 1000,
      // Retry transient network errors twice with exponential backoff.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      // Don't automatically refetch on every mount — rely on the cache.
      // Components can opt in to refetchOnMount: 'always' if they need it.
      refetchOnMount: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: false, // RN doesn't fire window focus; we use AppState
    },
    mutations: {
      // Same retry policy for mutations.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      // Phase 3.4: 'offlineFirst' means mutations run immediately when
      // online and queue (pause) when offline. On reconnect, the
      // persister restores paused mutations and the NetInfo listener
      // below calls resumePausedMutations() to fire them in order.
      networkMode: "offlineFirst",
    },
  },
});

// ─── Persistence: MMKV ───────────────────────────────────────────────────────

const persister = createAsyncStoragePersister({
  storage: mmkvAsyncAdapter,
  key: MMKV_CACHE_KEY,
  // Throttle writes so a burst of cache updates doesn't hammer MMKV.
  throttleTime: 1000,
});

// Kick off persistence. This returns a cleanup function we don't need in
// RN (the app lifetime == QueryClient lifetime). By default React Query
// 5 persists BOTH queries and paused mutations — no extra config needed.
// On hydration, any mutations that were paused (because the device was
// offline when the user force-quit) are restored and resumed once the
// online manager fires true.
persistQueryClient({
  queryClient,
  persister,
  // 7 days — plenty for the cache to stay warm across weeks of use.
  maxAge: 7 * 24 * 60 * 60 * 1000,
  // Buster: bump this string to nuke the entire persisted cache on a
  // breaking schema change. Keep in sync with any Database type shifts.
  buster: "v1-phase3.4",
});

// ─── Network state → React Query online manager ─────────────────────────────
// When the device loses/regains network, flip React Query's online status
// so queries pause/resume and mutations queue up.
//
// Phase 3.4: On reconnect we also explicitly resume paused mutations. This
// is the core of the offline queue — React Query pauses mutations while
// offline; they persist to MMKV via the persister above; and resume fires
// them in the original order the moment the device comes back online.

onlineManager.setEventListener((setOnline) => {
  const unsub = NetInfo.addEventListener((state) => {
    const isOnline =
      state.isConnected === true && state.isInternetReachable !== false;
    setOnline(isOnline);
    if (isOnline) {
      // Fire-and-forget: resume any queued mutations. Errors surface via
      // the individual mutation's onError + our error log ring buffer.
      queryClient.resumePausedMutations().catch((e) => {
        logError("query-client.resumePausedMutations", e);
      });
    }
  });
  return unsub;
});
