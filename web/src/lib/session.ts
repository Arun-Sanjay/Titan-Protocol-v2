/**
 * Session cache + auth helpers for the service layer.
 *
 * Services need the signed-in user's id to scope writes (`user_id`
 * column on every row). Instead of calling `supabase.auth.getSession()`
 * on every mutation — which hits localStorage and the supabase-js lock,
 * and can trigger a token-refresh cascade under tap-bursts — we hold a
 * single `currentUserId` module variable and let `WebAuthProvider`
 * update it whenever auth state changes.
 *
 * Mirrors the mobile app's approach, where `requireUserId` reads from a
 * Zustand store. Same net effect: zero I/O per write.
 *
 * Also re-exports the shared Supabase client so services that need it
 * (currently just `account.ts` for the server-side cascade delete and
 * `sync/*` for backup/restore) have a single import path.
 */

export { supabase } from "@titan/shared/lib/supabase";

import { useSyncExternalStore } from "react";

let currentUserId: string | null = null;
let currentUserEmail: string | null = null;
const listeners = new Set<() => void>();

/** Called by `WebAuthProvider` on every auth state change. */
export function setCurrentUser(
  userId: string | null,
  email: string | null = null,
): void {
  if (userId === currentUserId && email === currentUserEmail) return;
  currentUserId = userId;
  currentUserEmail = email;
  listeners.forEach((l) => l());
}

/** Synchronous read. Prefer over `requireUserId()` when caller can cope with null. */
export function getCurrentUserId(): string | null {
  return currentUserId;
}

export function getCurrentUserEmail(): string | null {
  return currentUserEmail;
}

/**
 * Return the signed-in user's id, or throw. Called from every service
 * write to scope the `user_id` column. Kept async for API parity with
 * mobile and the old shared/lib/supabase.ts signature — the body is
 * synchronous.
 */
export async function requireUserId(): Promise<string> {
  if (!currentUserId) throw new Error("Not authenticated");
  return currentUserId;
}

/**
 * React hook: subscribe to the current user id. Triggers a re-render
 * whenever `setCurrentUser` is called with a different value. Used by
 * every React Query hook so `enabled: Boolean(userId)` reacts to login
 * / logout without having to pipe through a provider.
 */
export function useCurrentUserId(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => currentUserId,
    () => null,
  );
}

export function useCurrentUserEmail(): string | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },
    () => currentUserEmail,
    () => null,
  );
}
