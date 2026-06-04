/**
 * Browser-only SQLite client. Dispatches to a dedicated Web Worker
 * (`sqlite-worker.ts`) because the OPFS SAH Pool VFS requires
 * `FileSystemSyncAccessHandle`, which only exists inside Worker contexts.
 *
 * Vite bundles the worker automatically via the
 * `new Worker(new URL("./sqlite-worker.ts", import.meta.url))` pattern.
 * The worker uses sqlite-wasm's main sqlite3InitModule (not Worker1,
 * which is deprecated and can't install SAH Pool).
 *
 * This file is never imported on the Tauri desktop build — see
 * `client.ts` for the runtime branch.
 */

import type { ClientImpl, RunResult } from "./client-types";

type WorkerOp = "init" | "all" | "get" | "run" | "exec";
type WorkerRequest = {
  id: number;
  op: WorkerOp;
  sql?: string;
  params?: unknown[];
};
type WorkerResponse =
  | { id: number; ok: true; result?: unknown }
  | { id: number; ok: false; error: string };

type Pending = {
  resolve: (value: unknown) => void;
  reject: (reason: Error) => void;
};

let worker: Worker | null = null;
let readyPromise: Promise<void> | null = null;
let nextId = 1;
const pending = new Map<number, Pending>();

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(
    new URL("./sqlite-worker.ts", import.meta.url),
    { type: "module" },
  );
  worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const { id } = e.data;
    const slot = pending.get(id);
    if (!slot) return;
    pending.delete(id);
    if (e.data.ok) {
      slot.resolve(e.data.result);
    } else {
      slot.reject(new Error(e.data.error));
    }
  };
  worker.onerror = (e: ErrorEvent) => {
    // The worker itself blew up (usually a module-load failure).
    // Reject every in-flight request with the event message.
    const err = new Error(e.message || "sqlite worker error");
    for (const slot of pending.values()) slot.reject(err);
    pending.clear();
  };
  return worker;
}

async function ready(): Promise<void> {
  if (readyPromise) return readyPromise;
  readyPromise = (async () => {
    await dispatch({ op: "init" });
  })();
  return readyPromise;
}

function dispatch(req: Omit<WorkerRequest, "id">): Promise<unknown> {
  const id = nextId++;
  const message: WorkerRequest = { id, ...req };
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage(message);
  });
}

function toParamsArray(params: unknown): unknown[] {
  if (params == null) return [];
  if (Array.isArray(params)) return params;
  return Object.values(params as Record<string, unknown>);
}

async function all<T>(sql: string, params: unknown = []): Promise<T[]> {
  await ready();
  const result = await dispatch({ op: "all", sql, params: toParamsArray(params) });
  return (result as T[]) ?? [];
}

async function get<T>(sql: string, params: unknown = []): Promise<T | null> {
  await ready();
  const result = await dispatch({ op: "get", sql, params: toParamsArray(params) });
  return (result as T | null) ?? null;
}

async function run(sql: string, params: unknown = []): Promise<RunResult> {
  await ready();
  const result = (await dispatch({
    op: "run",
    sql,
    params: toParamsArray(params),
  })) as RunResult;
  return {
    changes: result?.changes ?? 0,
    lastInsertRowId: result?.lastInsertRowId ?? 0,
  };
}

async function exec(source: string): Promise<void> {
  await ready();
  await dispatch({ op: "exec", sql: source });
}

let txDepth = 0;

async function transaction<T>(task: (tx: unknown) => Promise<T>): Promise<T> {
  if (txDepth === 0) {
    txDepth++;
    await exec("BEGIN");
    try {
      const result = await task(undefined);
      await exec("COMMIT");
      return result;
    } catch (err) {
      try {
        await exec("ROLLBACK");
      } catch {
        // already unwinding from the primary error
      }
      throw err;
    } finally {
      txDepth--;
    }
  }
  const sp = `sp_${txDepth}_${Date.now()}`;
  txDepth++;
  await exec(`SAVEPOINT ${sp}`);
  try {
    const result = await task(undefined);
    await exec(`RELEASE SAVEPOINT ${sp}`);
    return result;
  } catch (err) {
    try {
      await exec(`ROLLBACK TO SAVEPOINT ${sp}`);
      await exec(`RELEASE SAVEPOINT ${sp}`);
    } catch {
      // outer will clean up
    }
    throw err;
  } finally {
    txDepth--;
  }
}

export const impl: ClientImpl = { all, get, run, exec, transaction };
