import { create } from "zustand";

export type SyncStatus = "idle" | "syncing" | "error";

interface SyncState {
  status: SyncStatus;
  /** ISO timestamp of the last successful full cycle. */
  lastSyncAt: string | null;
  /** Last error message (shown in dev screen + OfflineBanner when surfaced). */
  lastError: string | null;
  /** Count of mutations still in the outbox after the most recent push. */
  pendingCount: number;
  setStatus: (status: SyncStatus, lastError?: string | null) => void;
  setPendingCount: (n: number) => void;
  markSuccess: () => void;
}

export const useSyncStore = create<SyncState>((set) => ({
  status: "idle",
  lastSyncAt: null,
  lastError: null,
  pendingCount: 0,
  setStatus: (status, lastError = null) => set({ status, lastError }),
  setPendingCount: (pendingCount) => set({ pendingCount }),
  markSuccess: () =>
    set({
      status: "idle",
      lastSyncAt: new Date().toISOString(),
      lastError: null,
    }),
}));
