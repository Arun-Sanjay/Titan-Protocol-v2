import { createMMKV } from "react-native-mmkv";
import { logError } from "../lib/error-log";

// Single MMKV instance — synchronous, no init needed, works instantly
export const storage = createMMKV({ id: "titan-protocol" });

// ─── Run migrations before anything reads from storage ────────────────────
import { runMigrations } from "../lib/migration";
runMigrations(storage);

// ─── Generic helpers ───────────────────────────────────────────────────────
//
// Phase 2.2B: previously these had bare `catch {}` blocks that silently
// swallowed parse/serialize failures. MMKV corruption, BigInt values,
// circular refs — all invisible. Now every failure funnels through
// error-log.ts (in-memory ring buffer + console.error). Phase 4.4 will
// add Sentry forwarding.

export function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    logError("storage.getJSON", e, {
      key,
      rawLength: raw.length,
      rawPreview: raw.slice(0, 120),
    });
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  if (value === undefined) return;
  try {
    storage.set(key, JSON.stringify(value));
  } catch (e) {
    // Non-serializable values (circular refs, BigInt, etc.) OR MMKV write
    // failures (full disk, permission issue on Android). Log it so we
    // notice — this would be an invisible data-loss bug otherwise.
    logError("storage.setJSON", e, {
      key,
      valueType: typeof value,
      isArray: Array.isArray(value),
    });
  }
}

// ─── ID generator ──────────────────────────────────────────────────────────

let _counter = storage.getNumber("id_counter") ?? 0;

export function nextId(): number {
  _counter++;
  try {
    storage.set("id_counter", _counter);
  } catch (e) {
    logError("storage.nextId", e, { counter: _counter });
  }
  return _counter;
}
