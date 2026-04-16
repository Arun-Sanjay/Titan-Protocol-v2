/**
 * Phase 6: Cloud sync engine.
 *
 * Subscribes to MMKV store changes and mirrors writes to Supabase.
 * Currently a no-op stub — the real sync logic will be implemented
 * once all services and hooks are wired. The stub returns a cleanup
 * function so _layout.tsx's useEffect works without changes.
 */

export function startCloudSync(): () => void {
  // TODO: subscribe to store changes, batch writes to Supabase
  return () => {
    // cleanup
  };
}
