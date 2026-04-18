import { AppState, type AppStateStatus } from "react-native";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import { logError } from "../lib/error-log";
import { queryClient } from "../lib/query-client";
import { countPending } from "./outbox";
import { pushAll } from "./push";
import { pullAll } from "./pull";
import { PULL_ORDER, queryKeysFor } from "./tables";
import { useSyncStore } from "./store";

// ─── Configuration ──────────────────────────────────────────────────────────

/** How often the engine polls for pull while app is foreground. */
const POLL_INTERVAL_MS = 60_000;

/** Debounce window after a local mutation before triggering a push. */
const MUTATION_DEBOUNCE_MS = 500;

// ─── Module state ───────────────────────────────────────────────────────────

let currentUserId: string | null = null;
let syncInFlight = false;

let appStateSub: { remove: () => void } | null = null;
let netInfoUnsub: (() => void) | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let mutationDebounceHandle: ReturnType<typeof setTimeout> | null = null;

// ─── syncNow ────────────────────────────────────────────────────────────────

export interface SyncOptions {
  /** Skip the pull cycle; only drain the outbox. */
  pushOnly?: boolean;
  /** Skip the push cycle; only pull remote changes. */
  pullOnly?: boolean;
  /** Ignore cursors and pull every row from scratch. Used by initial seed. */
  fullRefresh?: boolean;
}

/**
 * Run one full sync cycle. Safe to call concurrently — if a cycle is
 * already in flight, subsequent calls no-op until it completes. Returns
 * when both push + pull have finished.
 *
 * Sequence:
 *   1. Push all pending mutations (drain outbox).
 *   2. Pull remote changes for every table in PULL_ORDER.
 *   3. Invalidate React Query keys for each updated table.
 *   4. Record sync result in the SyncStore.
 */
export async function syncNow(options: SyncOptions = {}): Promise<void> {
  if (syncInFlight) return;
  if (!currentUserId && !options.fullRefresh) return;

  syncInFlight = true;
  useSyncStore.getState().setStatus("syncing");

  try {
    // ─── Push ────────────────────────────────────────────────────────
    if (!options.pullOnly) {
      const pushRes = await pushAll();
      if (pushRes.stopReason === "auth") {
        useSyncStore.getState().setStatus("error", "auth");
        return;
      }
    }

    // ─── Pull ────────────────────────────────────────────────────────
    if (!options.pushOnly) {
      const pullRes = await pullAll(PULL_ORDER, {
        fullRefresh: options.fullRefresh,
      });
      if (pullRes.stopReason === "auth") {
        useSyncStore.getState().setStatus("error", "auth");
        return;
      }
      // Invalidate query caches for tables that actually received rows.
      // Skipping empties avoids pointless refetch churn on idle syncs.
      for (const t of pullRes.perTable) {
        if (t.pulled > 0) {
          queryClient.invalidateQueries({
            queryKey: queryKeysFor(t.table),
            refetchType: "active",
          });
        }
      }
    }

    const pending = await countPending();
    useSyncStore.getState().setPendingCount(pending);
    useSyncStore.getState().markSuccess();
  } catch (err) {
    logError("sync.engine.syncNow", err);
    useSyncStore.getState().setStatus("error", extractMessage(err));
  } finally {
    syncInFlight = false;
  }
}

// ─── Background triggers ────────────────────────────────────────────────────

function onAppStateChange(next: AppStateStatus): void {
  if (next === "active") {
    void syncNow();
  }
}

function onNetInfoChange(state: NetInfoState): void {
  if (state.isConnected && state.isInternetReachable !== false) {
    void syncNow();
  }
}

function onInterval(): void {
  void syncNow();
}

/**
 * Start the sync engine for the given user. Idempotent — calling again
 * with the same user is a no-op; calling with a different user tears
 * down the previous hooks and re-arms for the new one.
 */
export function startBackgroundSync(userId: string): void {
  if (currentUserId === userId && intervalHandle) return;
  stopBackgroundSync();
  currentUserId = userId;

  // Initial sync on startup.
  void syncNow();

  // AppState: foreground → sync.
  appStateSub = AppState.addEventListener("change", onAppStateChange);

  // NetInfo: reconnect → sync.
  netInfoUnsub = NetInfo.addEventListener(onNetInfoChange);

  // Polling: every POLL_INTERVAL_MS while app is alive.
  intervalHandle = setInterval(onInterval, POLL_INTERVAL_MS);
}

export function stopBackgroundSync(): void {
  currentUserId = null;
  if (appStateSub) {
    appStateSub.remove();
    appStateSub = null;
  }
  if (netInfoUnsub) {
    netInfoUnsub();
    netInfoUnsub = null;
  }
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  if (mutationDebounceHandle) {
    clearTimeout(mutationDebounceHandle);
    mutationDebounceHandle = null;
  }
}

/**
 * Service functions call this after writing a row to SQLite + enqueueing
 * a mutation. Debounces a push-only syncNow so rapid interactions (tap
 * task → tap task → tap task) coalesce into a single network round.
 */
export function scheduleMutationPush(): void {
  if (mutationDebounceHandle) clearTimeout(mutationDebounceHandle);
  mutationDebounceHandle = setTimeout(() => {
    mutationDebounceHandle = null;
    void syncNow({ pushOnly: true });
  }, MUTATION_DEBOUNCE_MS);
}

/** Test-only accessor so unit tests can assert engine state. */
export function _getEngineState() {
  return {
    currentUserId,
    isRunning: intervalHandle !== null,
    syncInFlight,
  };
}

function extractMessage(err: unknown): string {
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return String(err ?? "unknown");
}
