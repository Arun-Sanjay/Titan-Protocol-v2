/**
 * Platform-branching SQLite client. One API — the runtime picks the
 * engine.
 *
 *   Browser  → sqlite-wasm (OPFS-SAH-Pool VFS)   see client-browser.ts
 *   Tauri    → @tauri-apps/plugin-sql (native)   see client-tauri.ts
 *   Vitest   → better-sqlite3 in-memory shim     see __tests__/setup/sqlite-fake.ts
 *              (vitest alias swaps this module at test time — no runtime
 *              branch needed here.)
 *
 * Interface mirrors mobile's `src/db/sqlite/client.ts` so services port
 * 1:1 between the two apps.
 */

import type { ClientImpl, RunResult } from "./client-types";

export type BindParams = unknown[] | Record<string, unknown>;
export type { RunResult };

let implPromise: Promise<ClientImpl> | null = null;

function detectTauri(): boolean {
  if (typeof window === "undefined") return false;
  // Tauri v2 sets __TAURI_INTERNALS__; v1 set __TAURI__.
  const w = window as unknown as Record<string, unknown>;
  return "__TAURI_INTERNALS__" in w || "__TAURI__" in w;
}

async function getImpl(): Promise<ClientImpl> {
  if (implPromise) return implPromise;
  implPromise = (async () => {
    if (detectTauri()) {
      const mod = await import("./client-tauri");
      return mod.impl;
    }
    const mod = await import("./client-browser");
    return mod.impl;
  })();
  return implPromise;
}

// Test-only: force a re-init of the client. Used by the vitest shim.
export function _resetClientForTests(): void {
  implPromise = null;
}

export async function all<T = unknown>(
  sql: string,
  params: BindParams = [],
): Promise<T[]> {
  const impl = await getImpl();
  return impl.all<T>(sql, params);
}

export async function get<T = unknown>(
  sql: string,
  params: BindParams = [],
): Promise<T | null> {
  const impl = await getImpl();
  return impl.get<T>(sql, params);
}

export async function run(
  sql: string,
  params: BindParams = [],
): Promise<RunResult> {
  const impl = await getImpl();
  return impl.run(sql, params);
}

export async function exec(source: string): Promise<void> {
  const impl = await getImpl();
  return impl.exec(source);
}

export async function transaction<T>(
  task: (tx: unknown) => Promise<T>,
): Promise<T> {
  const impl = await getImpl();
  return impl.transaction(task);
}
