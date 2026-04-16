import { createMMKV } from "react-native-mmkv";

/**
 * Phase 0: Global MMKV instance for device-local preferences.
 *
 * MMKV is ONLY for things that don't need to sync across devices:
 *   - Sound/voice/haptic toggles
 *   - Dev flags (dev_day_offset)
 *   - Story flags (cinematic played state)
 *   - UI mode cache
 *   - Theme preferences
 *   - React Query offline cache (via persister)
 *
 * User data belongs in Supabase. See CLAUDE.md §1.
 */
export const storage = createMMKV({ id: "titan-default" });

/** Read a JSON value from MMKV, returning `fallback` on miss or parse error. */
export function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write a JSON value to MMKV. */
export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

/** Auto-incrementing ID backed by MMKV. For local-only records. */
let _counter = 0;
export function nextId(): number {
  _counter = getJSON<number>("_next_id", 1);
  const id = _counter;
  setJSON("_next_id", _counter + 1);
  return id;
}
