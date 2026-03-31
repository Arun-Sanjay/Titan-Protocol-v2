import { createMMKV } from "react-native-mmkv";

// Single MMKV instance — synchronous, no init needed, works instantly
export const storage = createMMKV({ id: "titan-protocol" });

// ─── Run migrations before anything reads from storage ────────────────────
import { runMigrations } from "../lib/migration";
runMigrations(storage);

// ─── Generic helpers ───────────────────────────────────────────────────────

export function getJSON<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON(key: string, value: unknown): void {
  storage.set(key, JSON.stringify(value));
}

// ─── ID generator ──────────────────────────────────────────────────────────

let _counter = storage.getNumber("id_counter") ?? 0;

export function nextId(): number {
  _counter++;
  storage.set("id_counter", _counter);
  return _counter;
}
